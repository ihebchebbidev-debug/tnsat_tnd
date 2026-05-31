<?php
/**
 * Categories API — CRUD for product categories
 * GET    → list all (or ?id=xxx for one)
 * POST   → create { name, image_url, sort_order? }
 * PUT    → update ?id=xxx { name, image_url, sort_order? }
 * DELETE → delete ?id=xxx
 */
require_once __DIR__ . '/../config.php';

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

switch ($method) {
    case 'GET':
        if ($id) {
            $stmt = $db->prepare('SELECT c.*, (SELECT COUNT(*) FROM tnsatbeltnd_services s WHERE s.category = c.name) AS product_count FROM tnsatbeltnd_categories c WHERE c.id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if ($row) $row['visibility_mode'] = $row['visibility_mode'] ?? 'all';
            jsonResponse($row ?: ['error' => 'Not found'], $row ? 200 : 404);
        } else {
            $resellerId = $_GET['reseller_id'] ?? null;
            $stmt = $db->query('SELECT c.*, (SELECT COUNT(*) FROM tnsatbeltnd_services s WHERE s.category = c.name) AS product_count FROM tnsatbeltnd_categories c ORDER BY sort_order ASC, created_at ASC');
            $rows = $stmt->fetchAll();

            $listed = [];
            if ($resellerId) {
                $vstmt = $db->prepare('SELECT category_id FROM tnsatbeltnd_reseller_category_visibility WHERE reseller_id = ?');
                $vstmt->execute([$resellerId]);
                foreach ($vstmt->fetchAll(PDO::FETCH_COLUMN) as $cid) {
                    $listed[$cid] = true;
                }
            }

            $out = [];
            foreach ($rows as &$r) {
                $r['visibility_mode'] = $r['visibility_mode'] ?? 'all';
                if ($resellerId) {
                    $mode = $r['visibility_mode'];
                    $isListed = isset($listed[$r['id']]);
                    if ($mode === 'whitelist' && !$isListed) continue;
                    if ($mode === 'blacklist' && $isListed) continue;
                }
                $out[] = $r;
            }
            jsonResponse($out);
        }
        break;

    case 'POST':
        $data = getRequestBody();
        $name = trim($data['name'] ?? '');
        if (!$name) jsonResponse(['error' => 'Name is required'], 400);
        // Check duplicate
        $chk = $db->prepare('SELECT id FROM tnsatbeltnd_categories WHERE name = ?');
        $chk->execute([$name]);
        if ($chk->fetch()) jsonResponse(['error' => 'Category already exists'], 409);
        $id = bin2hex(random_bytes(16));
        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_categories (id, name, image_url, sort_order) VALUES (?, ?, ?, ?)');
        $stmt->execute([$id, $name, $data['image_url'] ?? '', intval($data['sort_order'] ?? 0)]);
        jsonResponse(['success' => true, 'id' => $id], 201);
        break;

    case 'PUT':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $data = getRequestBody();
        $name = trim($data['name'] ?? '');
        if (!$name) jsonResponse(['error' => 'Name is required'], 400);
        // Get old name for renaming services
        $old = $db->prepare('SELECT name FROM tnsatbeltnd_categories WHERE id = ?');
        $old->execute([$id]);
        $oldRow = $old->fetch();
        $stmt = $db->prepare('UPDATE tnsatbeltnd_categories SET name = ?, image_url = ?, sort_order = ? WHERE id = ?');
        $stmt->execute([$name, $data['image_url'] ?? '', intval($data['sort_order'] ?? 0), $id]);
        // Rename category on all services
        if ($oldRow && $oldRow['name'] !== $name) {
            $upd = $db->prepare('UPDATE tnsatbeltnd_services SET category = ? WHERE category = ?');
            $upd->execute([$name, $oldRow['name']]);
        }
        jsonResponse(['success' => true]);
        break;

    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        // Nullify category on services
        $cat = $db->prepare('SELECT name FROM tnsatbeltnd_categories WHERE id = ?');
        $cat->execute([$id]);
        $catRow = $cat->fetch();
        if ($catRow) {
            $upd = $db->prepare('UPDATE tnsatbeltnd_services SET category = NULL WHERE category = ?');
            $upd->execute([$catRow['name']]);
        }
        $stmt = $db->prepare('DELETE FROM tnsatbeltnd_categories WHERE id = ?');
        $stmt->execute([$id]);
        jsonResponse(['success' => true]);
        break;
}
