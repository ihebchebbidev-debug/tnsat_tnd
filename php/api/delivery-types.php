<?php
/**
 * Delivery Types API (MySQL)
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

switch ($method) {
    case 'GET':
        if ($id) {
            $db = getDB();
            $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_delivery_types WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) jsonResponse(['error' => 'Not found'], 404);
            $row['fields'] = json_decode($row['fields'], true);
            jsonResponse($row);
        } else {
            $db = getDB();
            $stmt = $db->query('SELECT * FROM tnsatbeltnd_delivery_types ORDER BY created_at DESC');
            $types = $stmt->fetchAll();
            foreach ($types as &$t) {
                $t['fields'] = json_decode($t['fields'], true);
            }
            jsonResponse($types);
        }
        break;

    case 'POST':
        $body = getRequestBody();
        $name = trim($body['name'] ?? '');
        $description = trim($body['description'] ?? '');
        $fields = $body['fields'] ?? [];
        
        if (!$name || empty($fields)) {
            jsonResponse(['error' => 'Name and fields are required'], 400);
        }

        $db = getDB();
        $id = bin2hex(random_bytes(16));
        $stmt = $db->prepare('INSERT INTO tnsatbeltnd_delivery_types (id, name, description, fields) VALUES (?, ?, ?, ?)');
        $stmt->execute([$id, $name, $description, json_encode($fields)]);
        
        jsonResponse(['id' => $id, 'name' => $name, 'description' => $description, 'fields' => $fields], 201);
        break;

    case 'PUT':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        
        $body = getRequestBody();
        $db = getDB();
        $stmt = $db->prepare('UPDATE tnsatbeltnd_delivery_types SET name = ?, description = ?, fields = ? WHERE id = ?');
        $stmt->execute([
            trim($body['name'] ?? ''),
            trim($body['description'] ?? ''),
            json_encode($body['fields'] ?? []),
            $id
        ]);
        
        jsonResponse(['success' => true]);
        break;

    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        
        $db = getDB();
        $stmt = $db->prepare('DELETE FROM tnsatbeltnd_delivery_types WHERE id = ?');
        $stmt->execute([$id]);
        
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
