<?php
/**
 * Recharge Codes API
 * GET          — list all codes (admin)
 * POST         — create code(s) (admin)
 * POST ?action=redeem — redeem a code (reseller)
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;

switch ($method) {
    case 'GET':
        $db = getDB();
        $stmt = $db->query('SELECT rc.*, r.name as reseller_name FROM tnsatbeltnd_recharge_codes rc LEFT JOIN tnsatbeltnd_resellers r ON rc.used_by_reseller_id = r.id ORDER BY rc.created_at DESC LIMIT 500');
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['credits'] = floatval($r['credits']);
            $r['is_used'] = intval($r['is_used']);
        }
        jsonResponse($rows);
        break;

    case 'POST':
        $db = getDB();
        $body = getRequestBody();

        if ($action === 'redeem') {
            // Reseller redeems a code
            $code = trim($body['code'] ?? '');
            $resellerId = $body['reseller_id'] ?? null;
            if (!$code || !$resellerId) jsonResponse(['error' => 'code and reseller_id required'], 400);

            $db->beginTransaction();
            try {
                $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_recharge_codes WHERE code = ? AND is_used = 0 FOR UPDATE');
                $stmt->execute([$code]);
                $rc = $stmt->fetch();
                if (!$rc) {
                    $db->rollBack();
                    jsonResponse(['error' => 'Code invalide ou déjà utilisé', 'error_en' => 'Invalid or already used code'], 400);
                }

                // Mark code as used
                $stmt = $db->prepare('UPDATE tnsatbeltnd_recharge_codes SET is_used = 1, used_by_reseller_id = ?, used_at = NOW() WHERE id = ?');
                $stmt->execute([$resellerId, $rc['id']]);

                // Add credits to reseller
                $credits = floatval($rc['credits']);
                $stmt = $db->prepare('UPDATE tnsatbeltnd_resellers SET credits = credits + ? WHERE id = ?');
                $stmt->execute([$credits, $resellerId]);

                // Get new balance
                $stmt = $db->prepare('SELECT credits FROM tnsatbeltnd_resellers WHERE id = ?');
                $stmt->execute([$resellerId]);
                $newBalance = floatval($stmt->fetchColumn());

                // Log transaction
                $txId = bin2hex(random_bytes(16));
                $stmt = $db->prepare('INSERT INTO tnsatbeltnd_point_transactions (id, reseller_id, type, amount, balance_after, description) VALUES (?, ?, "credit", ?, ?, ?)');
                $stmt->execute([$txId, $resellerId, $credits, $newBalance, "Recharge par code: $code"]);

                $db->commit();
                jsonResponse(['success' => true, 'credits_added' => $credits, 'new_balance' => $newBalance]);
            } catch (Exception $e) {
                $db->rollBack();
                jsonResponse(['error' => 'Failed to redeem code'], 500);
            }
            break;
        }

        if ($action === 'check') {
            // Check if code is valid without redeeming
            $code = trim($body['code'] ?? '');
            if (!$code) jsonResponse(['error' => 'code required'], 400);
            $stmt = $db->prepare('SELECT credits, is_used FROM tnsatbeltnd_recharge_codes WHERE code = ?');
            $stmt->execute([$code]);
            $rc = $stmt->fetch();
            if (!$rc) jsonResponse(['valid' => false, 'error' => 'Code introuvable']);
            if (intval($rc['is_used'])) jsonResponse(['valid' => false, 'error' => 'Code déjà utilisé']);
            jsonResponse(['valid' => true, 'credits' => floatval($rc['credits'])]);
            break;
        }

        // Create new code(s)
        $credits = floatval($body['credits'] ?? 0);
        $count = intval($body['count'] ?? 1);
        $prefix = trim($body['prefix'] ?? 'TNSAT');
        if ($credits <= 0) jsonResponse(['error' => 'credits must be > 0'], 400);
        if ($count < 1 || $count > 100) jsonResponse(['error' => 'count must be 1-100'], 400);

        $codes = [];
        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_recharge_codes (id, code, credits) VALUES (?, ?, ?)');
        for ($i = 0; $i < $count; $i++) {
            $id = bin2hex(random_bytes(16));
            $code = strtoupper($prefix) . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
            $stmt->execute([$id, $code, $credits]);
            $codes[] = ['id' => $id, 'code' => $code, 'credits' => $credits];
        }
        jsonResponse(['success' => true, 'codes' => $codes, 'count' => $count]);
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? null;
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $db = getDB();
        $stmt = $db->prepare('DELETE FROM tnsatbeltnd_recharge_codes WHERE id = ? AND is_used = 0');
        $stmt->execute([$id]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
