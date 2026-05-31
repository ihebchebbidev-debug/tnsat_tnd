<?php
/**
 * Reset Products API (MySQL)
 * Admin manages a catalog of "resettable items" with dynamic fields.
 * Resellers see this catalog and submit reset requests.
 *
 * Supports:
 *  - GET                       list all (optionally ?active=1)
 *  - GET ?id=...               single
 *  - POST    JSON or multipart (with image upload)
 *  - PUT ?id=...   JSON or multipart (with image upload)
 *  - DELETE ?id=...
 *  - POST ?action=request      reseller submits a reset request
 *                              body: { reset_product_id, reseller_id, values:{...} }
 *                              -> creates a `reset_request` notification
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? null;

function parseResetProductRow(&$row) {
    $row['fields'] = json_decode($row['fields'] ?? '[]', true) ?: [];
    $row['sort_order'] = intval($row['sort_order'] ?? 0);
    $row['is_active'] = intval($row['is_active'] ?? 1);
}

switch ($method) {
    case 'GET': {
        $db = getDB();
        if ($id) {
            $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_reset_products WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) jsonResponse(['error' => 'Not found'], 404);
            parseResetProductRow($row);
            jsonResponse($row);
        }
        $where = '';
        $params = [];
        if (isset($_GET['active'])) {
            $where = ' WHERE is_active = ?';
            $params[] = intval($_GET['active']) ? 1 : 0;
        }
        $stmt = $db->prepare("SELECT * FROM tnsatbeltnd_reset_products{$where} ORDER BY sort_order ASC, created_at DESC");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) parseResetProductRow($r);
        jsonResponse($rows);
        break;
    }

    case 'POST': {
        // Reseller submits a reset request -> create notification for admin
        if ($action === 'request') {
            $body = getRequestBody();
            $resetProductId = $body['reset_product_id'] ?? '';
            $resellerId = $body['reseller_id'] ?? null;
            $clientId = $body['client_id'] ?? null;
            $values = $body['values'] ?? [];
            if (!$resetProductId) jsonResponse(['error' => 'reset_product_id required'], 400);
            if (!$resellerId && !$clientId) jsonResponse(['error' => 'reseller_id or client_id required'], 400);

            $db = getDB();
            $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_reset_products WHERE id = ?');
            $stmt->execute([$resetProductId]);
            $product = $stmt->fetch();
            if (!$product) jsonResponse(['error' => 'Reset product not found'], 404);

            // Resolve reseller/client name for the message
            $name = '';
            if ($resellerId) {
                $st = $db->prepare('SELECT name FROM tnsatbeltnd_resellers WHERE id = ?');
                $st->execute([$resellerId]);
                $r = $st->fetch();
                $name = $r ? $r['name'] : 'Reseller';
            } elseif ($clientId) {
                $st = $db->prepare('SELECT name FROM tnsatbeltnd_clients WHERE id = ?');
                $st->execute([$clientId]);
                $r = $st->fetch();
                $name = $r ? $r['name'] : 'Client';
            }

            // Build a clean human-readable details block from values
            $lines = [];
            if (is_array($values)) {
                foreach ($values as $k => $v) {
                    if ($v === '' || $v === null) continue;
                    $lines[] = "$k: $v";
                }
            }
            $details = implode("\n", $lines);
            // Correlation id so the reseller/client side can match the admin's later reply
            // (reset_approved / reset_cancelled) to this exact request and show its real status.
            $cid = bin2hex(random_bytes(8));
            // Hidden marker so the admin "Approve / Cancel" handler can route the reply notification
            // back to the originating reseller/client. The frontend strips this from the displayed message.
            $marker = '[REQ:' . ($resellerId ? "reseller={$resellerId}" : "client={$clientId}") . "|product={$product['id']}]"
                . " [CID:{$cid}]";
            $message = "🔄 Reset Request — " . ($resellerId ? "Reseller" : "Client") . ": {$name} | Product: {$product['name']}"
                . ($details ? " | Details:\n{$details}" : '')
                . "\n" . $marker;

            // Create admin notification (no client_id / reseller_id => admin queue)
            $notifId = bin2hex(random_bytes(16));
            $ins = $db->prepare('INSERT INTO tnsatbeltnd_notifications (id, client_id, reseller_id, type, message, order_id, is_read) VALUES (?, NULL, NULL, ?, ?, NULL, 0)');
            $ins->execute([$notifId, 'reset_request', $message]);

            // Mirror notification on the reseller/client side so they have an immediate trace
            // of their own submission ("En attente"). When admin approves/cancels, a separate
            // reset_approved / reset_cancelled notification is added with the same [CID:...]
            // marker, allowing the UI to compute the resolved status.
            $mirrorId = bin2hex(random_bytes(16));
            $mirrorMsg = "🔄 " . $product['name']
                . ($details ? "\n" . $details : '')
                . "\n[CID:{$cid}]";
            $note = isset($body['note']) ? trim(substr((string)$body['note'], 0, 2000)) : '';
            $insMirror = $db->prepare('INSERT INTO tnsatbeltnd_notifications (id, client_id, reseller_id, type, message, reseller_note, order_id, is_read) VALUES (?, ?, ?, ?, ?, ?, NULL, 1)');
            $insMirror->execute([$mirrorId, $clientId, $resellerId, 'reset_request_sent', $mirrorMsg, $note === '' ? null : $note]);

            jsonResponse(['success' => true, 'notification_id' => $notifId, 'cid' => $cid], 201);
        }

        // Reseller/client edits a still-pending reset request (matched by CID).
        // Updates both the admin-side `reset_request` notification and the
        // mirror `reset_request_sent` notification belonging to the requester.
        // Refuses if the admin already replied (reset_approved / reset_cancelled).
        if ($action === 'edit_request') {
            $body = getRequestBody();
            $cid = trim($body['cid'] ?? '');
            $resellerId = $body['reseller_id'] ?? null;
            $clientId = $body['client_id'] ?? null;
            $values = $body['values'] ?? [];
            if (!$cid) jsonResponse(['error' => 'cid required'], 400);
            if (!$resellerId && !$clientId) jsonResponse(['error' => 'reseller_id or client_id required'], 400);

            $db = getDB();
            $cidMarker = '%[CID:' . $cid . ']%';

            // Block edit if admin already replied
            $stmt = $db->prepare("SELECT id FROM tnsatbeltnd_notifications WHERE type IN ('reset_approved','reset_cancelled') AND message LIKE ? LIMIT 1");
            $stmt->execute([$cidMarker]);
            if ($stmt->fetch()) jsonResponse(['error' => 'Cette demande a déjà été traitée'], 409);

            // Find the reseller/client mirror notification for ownership check
            if ($resellerId) {
                $stmt = $db->prepare("SELECT * FROM tnsatbeltnd_notifications WHERE type='reset_request_sent' AND reseller_id=? AND message LIKE ? LIMIT 1");
                $stmt->execute([$resellerId, $cidMarker]);
            } else {
                $stmt = $db->prepare("SELECT * FROM tnsatbeltnd_notifications WHERE type='reset_request_sent' AND client_id=? AND message LIKE ? LIMIT 1");
                $stmt->execute([$clientId, $cidMarker]);
            }
            $mirror = $stmt->fetch();
            if (!$mirror) jsonResponse(['error' => 'Demande introuvable'], 404);

            // Find the admin-side request notification (no client/reseller id)
            $stmt = $db->prepare("SELECT * FROM tnsatbeltnd_notifications WHERE type='reset_request' AND client_id IS NULL AND reseller_id IS NULL AND message LIKE ? LIMIT 1");
            $stmt->execute([$cidMarker]);
            $adminNotif = $stmt->fetch();

            // Build details block
            $lines = [];
            if (is_array($values)) {
                foreach ($values as $k => $v) {
                    if ($v === '' || $v === null) continue;
                    $lines[] = "$k: $v";
                }
            }
            $details = implode("\n", $lines);

            // Resolve requester name + product name from existing admin message if present;
            // otherwise rebuild from DB.
            $name = '';
            if ($resellerId) {
                $st = $db->prepare('SELECT name FROM tnsatbeltnd_resellers WHERE id = ?');
                $st->execute([$resellerId]);
                $r = $st->fetch();
                $name = $r ? $r['name'] : 'Reseller';
            } else {
                $st = $db->prepare('SELECT name FROM tnsatbeltnd_clients WHERE id = ?');
                $st->execute([$clientId]);
                $r = $st->fetch();
                $name = $r ? $r['name'] : 'Client';
            }

            // Extract product name from mirror first line "🔄 Product Name"
            $productName = '';
            if ($mirror && preg_match('/^🔄\s*(.+)$/m', $mirror['message'], $m)) {
                $productName = trim($m[1]);
            }

            // Preserve existing [REQ:...] marker from admin notif if present
            $reqMarker = '';
            if ($adminNotif && preg_match('/\[REQ:[^\]]*\]/', $adminNotif['message'], $m)) {
                $reqMarker = $m[0];
            }

            $editedTag = ' (modifiée)';
            $marker = ($reqMarker ? $reqMarker . ' ' : '') . '[CID:' . $cid . ']';
            $newAdminMsg = "🔄 Reset Request" . $editedTag . " — " . ($resellerId ? "Reseller" : "Client") . ": {$name}"
                . ($productName ? " | Product: {$productName}" : '')
                . ($details ? " | Details:\n{$details}" : '')
                . "\n" . $marker;
            $newMirrorMsg = "🔄 " . ($productName ?: 'Reset') . $editedTag
                . ($details ? "\n" . $details : '')
                . "\n[CID:" . $cid . "]";

            if ($adminNotif) {
                $upd = $db->prepare('UPDATE tnsatbeltnd_notifications SET message=?, is_read=0 WHERE id=?');
                $upd->execute([$newAdminMsg, $adminNotif['id']]);
            }
            if (array_key_exists('note', $body)) {
                $note = trim(substr((string)$body['note'], 0, 2000));
                $upd = $db->prepare('UPDATE tnsatbeltnd_notifications SET message=?, reseller_note=? WHERE id=?');
                $upd->execute([$newMirrorMsg, $note === '' ? null : $note, $mirror['id']]);
            } else {
                $upd = $db->prepare('UPDATE tnsatbeltnd_notifications SET message=? WHERE id=?');
                $upd->execute([$newMirrorMsg, $mirror['id']]);
            }

            jsonResponse(['success' => true]);
        }

        // Admin creates a reset product (multipart for image OR JSON)
        $db = getDB();
        $newId = bin2hex(random_bytes(16));

        if (isset($_FILES['image'])) {
            $name = trim($_POST['name'] ?? '');
            $description = trim($_POST['description'] ?? '');
            $sortOrder = isset($_POST['sort_order']) ? intval($_POST['sort_order']) : 0;
            $isActive = isset($_POST['is_active']) ? intval($_POST['is_active']) : 1;
            $fieldsRaw = $_POST['fields'] ?? '[]';
            $fields = is_string($fieldsRaw) ? (json_decode($fieldsRaw, true) ?: []) : (is_array($fieldsRaw) ? $fieldsRaw : []);

            $file = $_FILES['image'];
            $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!in_array($file['type'], $allowedTypes)) jsonResponse(['error' => 'Invalid image type'], 400);

            $uploadsDir = ensureUploadsDir();
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $filename = 'rst_' . $newId . '.' . $ext;
            $filepath = $uploadsDir . '/' . $filename;
            if (!move_uploaded_file($file['tmp_name'], $filepath)) jsonResponse(['error' => 'Failed to upload image'], 500);
            $imageUrl = getUploadUrl($filename);
        } else {
            $body = getRequestBody();
            $name = trim($body['name'] ?? '');
            $description = trim($body['description'] ?? '');
            $imageUrl = trim($body['image_url'] ?? '');
            $sortOrder = intval($body['sort_order'] ?? 0);
            $isActive = isset($body['is_active']) ? intval($body['is_active']) : 1;
            $fields = $body['fields'] ?? [];
        }

        if (!$name) jsonResponse(['error' => 'Name is required'], 400);
        if (!is_array($fields)) $fields = [];

        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_reset_products (id, name, description, image_url, fields, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$newId, $name, $description, $imageUrl ?? '', json_encode($fields), $sortOrder, $isActive]);

        jsonResponse(['id' => $newId, 'name' => $name, 'image_url' => $imageUrl ?? ''], 201);
        break;
    }

    case 'PUT': {
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $db = getDB();

        if (isset($_FILES['image'])) {
            $name = trim($_POST['name'] ?? '');
            $description = trim($_POST['description'] ?? '');
            $sortOrder = isset($_POST['sort_order']) ? intval($_POST['sort_order']) : 0;
            $isActive = isset($_POST['is_active']) ? intval($_POST['is_active']) : 1;
            $fieldsRaw = $_POST['fields'] ?? '[]';
            $fields = is_string($fieldsRaw) ? (json_decode($fieldsRaw, true) ?: []) : (is_array($fieldsRaw) ? $fieldsRaw : []);

            $file = $_FILES['image'];
            $uploadsDir = ensureUploadsDir();
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $filename = 'rst_' . $id . '.' . $ext;
            $filepath = $uploadsDir . '/' . $filename;
            move_uploaded_file($file['tmp_name'], $filepath);
            $imageUrl = getUploadUrl($filename);

            $stmt = $db->prepare('UPDATE tnsatbeltnd_reset_products SET name=?, description=?, image_url=?, fields=?, sort_order=?, is_active=? WHERE id=?');
            $stmt->execute([$name, $description, $imageUrl, json_encode($fields), $sortOrder, $isActive, $id]);
        } else {
            $body = getRequestBody();
            $name = trim($body['name'] ?? '');
            $description = trim($body['description'] ?? '');
            $imageUrl = trim($body['image_url'] ?? '');
            $sortOrder = intval($body['sort_order'] ?? 0);
            $isActive = isset($body['is_active']) ? intval($body['is_active']) : 1;
            $fields = $body['fields'] ?? [];
            if (!is_array($fields)) $fields = [];

            $stmt = $db->prepare('UPDATE tnsatbeltnd_reset_products SET name=?, description=?, image_url=?, fields=?, sort_order=?, is_active=? WHERE id=?');
            $stmt->execute([$name, $description, $imageUrl, json_encode($fields), $sortOrder, $isActive, $id]);
        }

        jsonResponse(['success' => true]);
        break;
    }

    case 'DELETE': {
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $db = getDB();
        $stmt = $db->prepare('DELETE FROM tnsatbeltnd_reset_products WHERE id = ?');
        $stmt->execute([$id]);
        jsonResponse(['success' => true]);
        break;
    }

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
