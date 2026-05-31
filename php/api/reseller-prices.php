<?php
/**
 * Reseller-specific service price overrides (admin)
 *
 * GET ?service_id=xxx                  → list overrides for a service
 *      [{ reseller_id, reseller_name, reseller_email, price_credits }]
 * GET ?reseller_id=xxx                 → list overrides for a reseller
 * POST   body: { service_id, reseller_id, price_credits }   → upsert override
 * DELETE ?service_id=xxx&reseller_id=yyy                    → remove override (reseller falls back to default)
 * POST ?action=reset_all  body: { service_id }              → remove ALL overrides for a service
 *      (so every reseller sees the same default price again)
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;

switch ($method) {
    case 'GET': {
        $db = getDB();
        $serviceId = $_GET['service_id'] ?? null;
        $resellerId = $_GET['reseller_id'] ?? null;
        if ($serviceId) {
            $stmt = $db->prepare('SELECT p.service_id, p.reseller_id, p.price_credits, r.name AS reseller_name, r.email AS reseller_email
                                  FROM tnsatbeltnd_reseller_service_prices p
                                  JOIN tnsatbeltnd_resellers r ON r.id = p.reseller_id
                                  WHERE p.service_id = ?
                                  ORDER BY r.name ASC');
            $stmt->execute([$serviceId]);
        } elseif ($resellerId) {
            $stmt = $db->prepare('SELECT p.service_id, p.reseller_id, p.price_credits, s.name AS service_name
                                  FROM tnsatbeltnd_reseller_service_prices p
                                  JOIN tnsatbeltnd_services s ON s.id = p.service_id
                                  WHERE p.reseller_id = ?');
            $stmt->execute([$resellerId]);
        } else {
            jsonResponse(['error' => 'service_id or reseller_id required'], 400);
        }
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) { $r['price_credits'] = floatval($r['price_credits']); }
        jsonResponse($rows);
        break;
    }

    case 'POST': {
        $body = getRequestBody();
        $db = getDB();

        if ($action === 'reset_all') {
            $serviceId = $body['service_id'] ?? null;
            if (!$serviceId) jsonResponse(['error' => 'service_id required'], 400);
            $stmt = $db->prepare('DELETE FROM tnsatbeltnd_reseller_service_prices WHERE service_id = ?');
            $stmt->execute([$serviceId]);
            jsonResponse(['success' => true, 'deleted' => $stmt->rowCount()]);
        }

        $serviceId = $body['service_id'] ?? null;
        $resellerId = $body['reseller_id'] ?? null;
        $price = isset($body['price_credits']) ? floatval($body['price_credits']) : null;
        if (!$serviceId || !$resellerId || $price === null) {
            jsonResponse(['error' => 'service_id, reseller_id, price_credits required'], 400);
        }
        if ($price < 0) jsonResponse(['error' => 'price_credits must be >= 0'], 400);

        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_reseller_service_prices (service_id, reseller_id, price_credits)
                              VALUES (?, ?, ?)
                              ON DUPLICATE KEY UPDATE price_credits = VALUES(price_credits)');
        $stmt->execute([$serviceId, $resellerId, $price]);
        jsonResponse(['success' => true]);
        break;
    }

    case 'DELETE': {
        $serviceId = $_GET['service_id'] ?? null;
        $resellerId = $_GET['reseller_id'] ?? null;
        if (!$serviceId || !$resellerId) jsonResponse(['error' => 'service_id and reseller_id required'], 400);
        $db = getDB();
        $stmt = $db->prepare('DELETE FROM tnsatbeltnd_reseller_service_prices WHERE service_id = ? AND reseller_id = ?');
        $stmt->execute([$serviceId, $resellerId]);
        jsonResponse(['success' => true]);
        break;
    }

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
