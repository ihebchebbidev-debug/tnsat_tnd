<?php
/**
 * Per-service visibility (admin)
 *
 * GET    ?service_id=xxx
 *   → { service_id, mode: 'all'|'whitelist'|'blacklist',
 *       resellers: [{ reseller_id, name, email }] }
 *
 * POST   body: { service_id, mode: 'all'|'whitelist'|'blacklist', reseller_ids: string[] }
 *   → replaces the visibility list AND updates the service mode
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET': {
        $serviceId = $_GET['service_id'] ?? null;
        if (!$serviceId) jsonResponse(['error' => 'service_id required'], 400);
        $db = getDB();

        $stmt = $db->prepare('SELECT visibility_mode FROM tnsatbeltnd_services WHERE id = ?');
        $stmt->execute([$serviceId]);
        $svc = $stmt->fetch();
        if (!$svc) jsonResponse(['error' => 'Service not found'], 404);

        $stmt = $db->prepare('SELECT v.reseller_id, r.name, r.email
                              FROM tnsatbeltnd_reseller_service_visibility v
                              JOIN tnsatbeltnd_resellers r ON r.id = v.reseller_id
                              WHERE v.service_id = ?
                              ORDER BY r.name ASC');
        $stmt->execute([$serviceId]);
        jsonResponse([
            'service_id' => $serviceId,
            'mode' => $svc['visibility_mode'] ?: 'all',
            'resellers' => $stmt->fetchAll(),
        ]);
        break;
    }

    case 'POST': {
        $body = getRequestBody();
        $serviceId = $body['service_id'] ?? null;
        $mode = $body['mode'] ?? 'all';
        $resellerIds = $body['reseller_ids'] ?? [];
        if (!$serviceId) jsonResponse(['error' => 'service_id required'], 400);
        if (!in_array($mode, ['all', 'whitelist', 'blacklist'], true)) {
            jsonResponse(['error' => 'invalid mode'], 400);
        }
        if (!is_array($resellerIds)) $resellerIds = [];

        $db = getDB();
        $db->beginTransaction();
        try {
            $stmt = $db->prepare('UPDATE tnsatbeltnd_services SET visibility_mode = ? WHERE id = ?');
            $stmt->execute([$mode, $serviceId]);

            // Replace the list
            $del = $db->prepare('DELETE FROM tnsatbeltnd_reseller_service_visibility WHERE service_id = ?');
            $del->execute([$serviceId]);

            if ($mode !== 'all' && count($resellerIds) > 0) {
                $ins = $db->prepare('INSERT IGNORE INTO tnsatbeltnd_reseller_service_visibility (service_id, reseller_id) VALUES (?, ?)');
                foreach ($resellerIds as $rid) {
                    if (is_string($rid) && $rid !== '') $ins->execute([$serviceId, $rid]);
                }
            }
            $db->commit();
            jsonResponse(['success' => true, 'mode' => $mode, 'count' => count($resellerIds)]);
        } catch (Exception $e) {
            $db->rollBack();
            jsonResponse(['error' => $e->getMessage()], 500);
        }
        break;
    }

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
