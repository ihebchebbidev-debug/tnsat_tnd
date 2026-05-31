<?php
/**
 * Per-category visibility (admin)
 *
 * GET    ?category_id=xxx
 *   → { category_id, mode, resellers: [{ reseller_id, name, email }] }
 *
 * POST   body: { category_id, mode, reseller_ids: string[] }
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET': {
        $categoryId = $_GET['category_id'] ?? null;
        if (!$categoryId) jsonResponse(['error' => 'category_id required'], 400);
        $db = getDB();

        $stmt = $db->prepare('SELECT visibility_mode FROM tnsatbeltnd_categories WHERE id = ?');
        $stmt->execute([$categoryId]);
        $cat = $stmt->fetch();
        if (!$cat) jsonResponse(['error' => 'Category not found'], 404);

        $stmt = $db->prepare('SELECT v.reseller_id, r.name, r.email
                              FROM tnsatbeltnd_reseller_category_visibility v
                              JOIN tnsatbeltnd_resellers r ON r.id = v.reseller_id
                              WHERE v.category_id = ?
                              ORDER BY r.name ASC');
        $stmt->execute([$categoryId]);
        jsonResponse([
            'category_id' => $categoryId,
            'mode' => $cat['visibility_mode'] ?: 'all',
            'resellers' => $stmt->fetchAll(),
        ]);
        break;
    }

    case 'POST': {
        $body = getRequestBody();
        $categoryId = $body['category_id'] ?? null;
        $mode = $body['mode'] ?? 'all';
        $resellerIds = $body['reseller_ids'] ?? [];
        if (!$categoryId) jsonResponse(['error' => 'category_id required'], 400);
        if (!in_array($mode, ['all', 'whitelist', 'blacklist'], true)) {
            jsonResponse(['error' => 'invalid mode'], 400);
        }
        if (!is_array($resellerIds)) $resellerIds = [];

        $db = getDB();
        $db->beginTransaction();
        try {
            $stmt = $db->prepare('UPDATE tnsatbeltnd_categories SET visibility_mode = ? WHERE id = ?');
            $stmt->execute([$mode, $categoryId]);

            $del = $db->prepare('DELETE FROM tnsatbeltnd_reseller_category_visibility WHERE category_id = ?');
            $del->execute([$categoryId]);

            if ($mode !== 'all' && count($resellerIds) > 0) {
                $ins = $db->prepare('INSERT IGNORE INTO tnsatbeltnd_reseller_category_visibility (category_id, reseller_id) VALUES (?, ?)');
                foreach ($resellerIds as $rid) {
                    if (is_string($rid) && $rid !== '') $ins->execute([$categoryId, $rid]);
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
