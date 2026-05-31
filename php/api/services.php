<?php
/**
 * Services API (MySQL) — with image upload, specifications, features & category support
 * Uses price_credits (DECIMAL) instead of price_points (INT)
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

function parseServiceRow(&$row) {
    $row['price_tnd'] = floatval($row['price_tnd']);
    $row['price_credits'] = floatval($row['price_credits']);
    $row['stock'] = $row['stock'] !== null ? intval($row['stock']) : null;
    $row['specifications'] = json_decode($row['specifications'] ?? 'null', true);
    $row['features'] = json_decode($row['features'] ?? 'null', true);
    $row['category'] = $row['category'] ?? null;
    $row['sale_type'] = $row['sale_type'] ?? 'command';
    $row['visibility_mode'] = $row['visibility_mode'] ?? 'all';
}

function normalizeSaleType($v) {
    return ($v === 'stock') ? 'stock' : 'command';
}

switch ($method) {
    case 'GET':
        $db = getDB();
        if ($id) {
            $stmt = $db->prepare('SELECT s.*, dt.name as delivery_type_name FROM tnsatbeltnd_services s LEFT JOIN tnsatbeltnd_delivery_types dt ON s.delivery_type_id = dt.id WHERE s.id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) jsonResponse(['error' => 'Not found'], 404);
            parseServiceRow($row);
            jsonResponse($row);
        } else {
            $category = $_GET['category'] ?? null;
            $resellerId = $_GET['reseller_id'] ?? null;
            $where = '';
            $params = [];
            if ($category) {
                $where = ' WHERE s.category = ?';
                $params[] = $category;
            }
            $stmt = $db->prepare("SELECT s.*, dt.name as delivery_type_name FROM tnsatbeltnd_services s LEFT JOIN tnsatbeltnd_delivery_types dt ON s.delivery_type_id = dt.id{$where} ORDER BY s.created_at DESC");
            $stmt->execute($params);
            $rows = $stmt->fetchAll();

            // Apply per-reseller price overrides if reseller_id is provided
            $overrides = [];
            $visibilityList = [];
            $hiddenCategoryNames = [];
            if ($resellerId) {
                $ostmt = $db->prepare('SELECT service_id, price_credits FROM tnsatbeltnd_reseller_service_prices WHERE reseller_id = ?');
                $ostmt->execute([$resellerId]);
                foreach ($ostmt->fetchAll() as $o) {
                    $overrides[$o['service_id']] = floatval($o['price_credits']);
                }
                $vstmt = $db->prepare('SELECT service_id FROM tnsatbeltnd_reseller_service_visibility WHERE reseller_id = ?');
                $vstmt->execute([$resellerId]);
                foreach ($vstmt->fetchAll(PDO::FETCH_COLUMN) as $sid) {
                    $visibilityList[$sid] = true;
                }

                // Compute hidden categories for this reseller
                $cstmt = $db->query('SELECT id, name, COALESCE(visibility_mode, "all") AS visibility_mode FROM tnsatbeltnd_categories');
                $cats = $cstmt->fetchAll();
                $catListed = [];
                $clstmt = $db->prepare('SELECT category_id FROM tnsatbeltnd_reseller_category_visibility WHERE reseller_id = ?');
                $clstmt->execute([$resellerId]);
                foreach ($clstmt->fetchAll(PDO::FETCH_COLUMN) as $cid) {
                    $catListed[$cid] = true;
                }
                foreach ($cats as $c) {
                    $m = $c['visibility_mode'];
                    $isL = isset($catListed[$c['id']]);
                    $hidden = ($m === 'whitelist' && !$isL) || ($m === 'blacklist' && $isL);
                    if ($hidden) $hiddenCategoryNames[$c['name']] = true;
                }
            }

            $out = [];
            foreach ($rows as &$r) {
                parseServiceRow($r);
                if ($resellerId) {
                    $mode = $r['visibility_mode'] ?? 'all';
                    $listed = isset($visibilityList[$r['id']]);
                    if ($mode === 'whitelist' && !$listed) continue;
                    if ($mode === 'blacklist' && $listed) continue;
                    if ($r['category'] && isset($hiddenCategoryNames[$r['category']])) continue;
                    // Hide stock-type services with no available stock from resellers
                    if (($r['sale_type'] ?? 'command') === 'stock' && ($r['stock'] === null || intval($r['stock']) <= 0)) continue;
                    $r['default_price_credits'] = $r['price_credits'];
                    if (array_key_exists($r['id'], $overrides)) {
                        $r['price_credits'] = $overrides[$r['id']];
                        $r['has_custom_price'] = true;
                    } else {
                        $r['has_custom_price'] = false;
                    }
                }
                $out[] = $r;
            }
            jsonResponse($out);
        }
        break;

    case 'POST':
        $db = getDB();
        $id = bin2hex(random_bytes(16));
        
        if (isset($_FILES['image'])) {
            $name = $_POST['name'] ?? '';
            $description = $_POST['description'] ?? '';
            $priceTnd = floatval($_POST['price_tnd'] ?? 0);
            $priceCredits = floatval($_POST['price_credits'] ?? 0);
            $stock = isset($_POST['stock']) && $_POST['stock'] !== '' ? intval($_POST['stock']) : null;
            $deliveryTypeId = $_POST['delivery_type_id'] ?? null;
            $category = isset($_POST['category']) && $_POST['category'] !== '' ? $_POST['category'] : null;
            $specifications = isset($_POST['specifications']) ? $_POST['specifications'] : null;
            $features = isset($_POST['features']) ? $_POST['features'] : null;
            $saleType = normalizeSaleType($_POST['sale_type'] ?? 'command');
            
            $file = $_FILES['image'];
            $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!in_array($file['type'], $allowedTypes)) {
                jsonResponse(['error' => 'Invalid image type'], 400);
            }
            
            $uploadsDir = ensureUploadsDir();
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $filename = 'svc_' . $id . '.' . $ext;
            $filepath = $uploadsDir . '/' . $filename;
            
            if (!move_uploaded_file($file['tmp_name'], $filepath)) {
                jsonResponse(['error' => 'Failed to upload image'], 500);
            }
            
            $imageUrl = getUploadUrl($filename);
        } else {
            $body = getRequestBody();
            $name = trim($body['name'] ?? '');
            $description = trim($body['description'] ?? '');
            $imageUrl = trim($body['image_url'] ?? '');
            $priceTnd = floatval($body['price_tnd'] ?? 0);
            $priceCredits = floatval($body['price_credits'] ?? 0);
            $stock = isset($body['stock']) && $body['stock'] !== '' ? intval($body['stock']) : null;
            $deliveryTypeId = $body['delivery_type_id'] ?? null;
            $category = isset($body['category']) && $body['category'] !== '' ? trim($body['category']) : null;
            $specifications = isset($body['specifications']) ? json_encode($body['specifications']) : null;
            $features = isset($body['features']) ? json_encode($body['features']) : null;
            $saleType = normalizeSaleType($body['sale_type'] ?? 'command');
        }
        
        if (!$name) jsonResponse(['error' => 'Name is required'], 400);
        
        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_services (id, name, description, image_url, price_tnd, price_credits, stock, delivery_type_id, category, specifications, features, sale_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$id, $name, $description, $imageUrl, $priceTnd, $priceCredits, $stock, $deliveryTypeId ?: null, $category, $specifications, $features, $saleType]);
        
        jsonResponse(['id' => $id, 'name' => $name, 'image_url' => $imageUrl], 201);
        break;

    case 'PUT':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        
        $db = getDB();
        
        if (isset($_FILES['image'])) {
            $name = $_POST['name'] ?? '';
            $description = $_POST['description'] ?? '';
            $priceTnd = floatval($_POST['price_tnd'] ?? 0);
            $priceCredits = floatval($_POST['price_credits'] ?? 0);
            $stock = isset($_POST['stock']) && $_POST['stock'] !== '' ? intval($_POST['stock']) : null;
            $deliveryTypeId = $_POST['delivery_type_id'] ?? null;
            $category = isset($_POST['category']) && $_POST['category'] !== '' ? $_POST['category'] : null;
            $specifications = isset($_POST['specifications']) ? $_POST['specifications'] : null;
            $features = isset($_POST['features']) ? $_POST['features'] : null;
            $saleType = normalizeSaleType($_POST['sale_type'] ?? 'command');
            
            $file = $_FILES['image'];
            $uploadsDir = ensureUploadsDir();
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $filename = 'svc_' . $id . '.' . $ext;
            $filepath = $uploadsDir . '/' . $filename;
            move_uploaded_file($file['tmp_name'], $filepath);
            
            $imageUrl = getUploadUrl($filename);
            
            $stmt = $db->prepare('UPDATE tnsatbeltnd_services SET name=?, description=?, image_url=?, price_tnd=?, price_credits=?, stock=?, delivery_type_id=?, category=?, specifications=?, features=?, sale_type=? WHERE id=?');
            $stmt->execute([$name, $description, $imageUrl, $priceTnd, $priceCredits, $stock, $deliveryTypeId ?: null, $category, $specifications, $features, $saleType, $id]);
        } else {
            $body = getRequestBody();
            $specifications = isset($body['specifications']) ? json_encode($body['specifications']) : null;
            $features = isset($body['features']) ? json_encode($body['features']) : null;
            $category = isset($body['category']) && $body['category'] !== '' ? trim($body['category']) : null;
            $saleType = normalizeSaleType($body['sale_type'] ?? 'command');
            
            $stmt = $db->prepare('UPDATE tnsatbeltnd_services SET name=?, description=?, image_url=?, price_tnd=?, price_credits=?, stock=?, delivery_type_id=?, category=?, specifications=?, features=?, sale_type=? WHERE id=?');
            $stmt->execute([
                trim($body['name'] ?? ''),
                trim($body['description'] ?? ''),
                trim($body['image_url'] ?? ''),
                floatval($body['price_tnd'] ?? 0),
                floatval($body['price_credits'] ?? 0),
                isset($body['stock']) && $body['stock'] !== '' ? intval($body['stock']) : null,
                ($body['delivery_type_id'] ?? null) ?: null,
                $category,
                $specifications,
                $features,
                $saleType,
                $id
            ]);
        }
        
        jsonResponse(['success' => true]);
        break;

    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $db = getDB();
        $stmt = $db->prepare('DELETE FROM tnsatbeltnd_services WHERE id = ?');
        $stmt->execute([$id]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}