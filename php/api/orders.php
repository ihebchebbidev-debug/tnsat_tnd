<?php
/**
 * Orders API (MySQL) — with pagination, race-safe, cancel/refund support
 * Uses credits (DECIMAL) instead of points (INT)
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? null;

switch ($method) {
    case 'GET':
        $db = getDB();
        if ($id) {
            $stmt = $db->prepare('
                SELECT o.*, s.name as service_name, s.delivery_type_id,
                       dt.name as delivery_type_name, dt.fields as delivery_type_fields
                FROM tnsatbeltnd_orders o
                LEFT JOIN tnsatbeltnd_services s ON o.service_id = s.id
                LEFT JOIN tnsatbeltnd_delivery_types dt ON s.delivery_type_id = dt.id
                WHERE o.id = ?
            ');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) jsonResponse(['error' => 'Not found'], 404);
            $row['credentials'] = json_decode($row['credentials'] ?? 'null', true);
            $row['delivery_type_fields'] = json_decode($row['delivery_type_fields'] ?? '[]', true);
            $row['credits_used'] = floatval($row['credits_used']);
            jsonResponse($row);
        } else {
            $clientId = $_GET['client_id'] ?? null;
            $resellerId = $_GET['reseller_id'] ?? null;
            $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : null;
            $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 20;
            $search = $_GET['search'] ?? null;
            $status = $_GET['status'] ?? null;

            $baseFrom = '
                FROM tnsatbeltnd_orders o
                LEFT JOIN tnsatbeltnd_services s ON o.service_id = s.id
                LEFT JOIN tnsatbeltnd_clients c ON o.client_id = c.id
                LEFT JOIN tnsatbeltnd_resellers r ON o.reseller_id = r.id
                LEFT JOIN tnsatbeltnd_delivery_types dt ON s.delivery_type_id = dt.id
            ';
            $params = [];
            $conditions = [];
            if ($clientId) { $conditions[] = 'o.client_id = ?'; $params[] = $clientId; }
            if ($resellerId) { $conditions[] = 'o.reseller_id = ?'; $params[] = $resellerId; }
            if ($status) { $conditions[] = 'o.status = ?'; $params[] = $status; }
            if ($search) {
                $conditions[] = '(s.name LIKE ? OR c.name LIKE ? OR r.name LIKE ?)';
                $params[] = "%{$search}%";
                $params[] = "%{$search}%";
                $params[] = "%{$search}%";
            }
            $where = !empty($conditions) ? ' WHERE ' . implode(' AND ', $conditions) : '';

            $selectCols = 'o.*, s.name as service_name, c.name as client_name, c.email as client_email, r.name as reseller_name, s.delivery_type_id, dt.name as delivery_type_name, dt.fields as delivery_type_fields';

            if ($page !== null) {
                $countStmt = $db->prepare("SELECT COUNT(*) {$baseFrom}{$where}");
                $countStmt->execute($params);
                $total = intval($countStmt->fetchColumn());

                $offset = ($page - 1) * $limit;
                $stmt = $db->prepare("SELECT {$selectCols} {$baseFrom}{$where} ORDER BY o.created_at DESC LIMIT {$limit} OFFSET {$offset}");
                $stmt->execute($params);
                $orders = $stmt->fetchAll();
                foreach ($orders as &$o) {
                    $o['credentials'] = json_decode($o['credentials'] ?? 'null', true);
                    $o['delivery_type_fields'] = json_decode($o['delivery_type_fields'] ?? '[]', true);
                    $o['credits_used'] = floatval($o['credits_used']);
                    $o['duration_months'] = intval($o['duration_months'] ?? 12);
                }
                jsonResponse(['data' => $orders, 'total' => $total, 'page' => $page, 'limit' => $limit]);
            } else {
                $stmt = $db->prepare("SELECT {$selectCols} {$baseFrom}{$where} ORDER BY o.created_at DESC");
                $stmt->execute($params);
                $orders = $stmt->fetchAll();
                foreach ($orders as &$o) {
                    $o['credentials'] = json_decode($o['credentials'] ?? 'null', true);
                    $o['delivery_type_fields'] = json_decode($o['delivery_type_fields'] ?? '[]', true);
                    $o['credits_used'] = floatval($o['credits_used']);
                    $o['duration_months'] = intval($o['duration_months'] ?? 12);
                }
                jsonResponse($orders);
            }
        }
        break;

    case 'POST':
        $body = getRequestBody();
        $clientId = $body['client_id'] ?? null;
        $resellerId = $body['reseller_id'] ?? null;
        $serviceId = $body['service_id'] ?? '';
        $note = trim($body['note'] ?? '');
        $durationMonths = intval($body['duration_months'] ?? 12);
        if ($durationMonths < 1) $durationMonths = 12;
        if (!$serviceId || (!$clientId && !$resellerId)) {
            jsonResponse(['error' => 'service_id and (client_id or reseller_id) required'], 400);
        }

        $db = getDB();
        $db->beginTransaction();
        
        try {
            if ($resellerId) {
                $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_resellers WHERE id = ? FOR UPDATE');
                $stmt->execute([$resellerId]);
                $buyer = $stmt->fetch();
                if (!$buyer) { $db->rollBack(); jsonResponse(['error' => 'Reseller not found'], 404); }
                if (!intval($buyer['is_active'])) { $db->rollBack(); jsonResponse(['error' => 'Account is inactive'], 403); }
                $buyerCredits = floatval($buyer['credits']);
                $buyerTable = 'tnsatbeltnd_resellers';
                $buyerId = $resellerId;
            } else {
                $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_clients WHERE id = ? FOR UPDATE');
                $stmt->execute([$clientId]);
                $buyer = $stmt->fetch();
                if (!$buyer) { $db->rollBack(); jsonResponse(['error' => 'Client not found'], 404); }
                if (!intval($buyer['is_active'] ?? 1)) { $db->rollBack(); jsonResponse(['error' => 'Account is inactive'], 403); }
                $buyerCredits = floatval($buyer['credits']);
                $buyerTable = 'tnsatbeltnd_clients';
                $buyerId = $clientId;
            }
            
            $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_services WHERE id = ? FOR UPDATE');
            $stmt->execute([$serviceId]);
            $service = $stmt->fetch();
            if (!$service) { $db->rollBack(); jsonResponse(['error' => 'Service not found'], 404); }
            
            $priceCredits = floatval($service['price_credits']);

            // Per-reseller price override + visibility check
            if ($resellerId) {
                $mode = $service['visibility_mode'] ?? 'all';
                if ($mode !== 'all') {
                    $vStmt = $db->prepare('SELECT 1 FROM tnsatbeltnd_reseller_service_visibility WHERE service_id = ? AND reseller_id = ?');
                    $vStmt->execute([$serviceId, $resellerId]);
                    $listed = (bool)$vStmt->fetchColumn();
                    if (($mode === 'whitelist' && !$listed) || ($mode === 'blacklist' && $listed)) {
                        $db->rollBack();
                        jsonResponse(['error' => 'Service not available for this reseller'], 403);
                    }
                }
                $ovStmt = $db->prepare('SELECT price_credits FROM tnsatbeltnd_reseller_service_prices WHERE service_id = ? AND reseller_id = ?');
                $ovStmt->execute([$serviceId, $resellerId]);
                $ov = $ovStmt->fetchColumn();
                if ($ov !== false && $ov !== null) {
                    $priceCredits = floatval($ov);
                }
            }
            
            if ($buyerCredits < $priceCredits) {
                $db->rollBack();
                jsonResponse(['error' => 'Not enough credits'], 400);
            }
            
            if ($service['stock'] !== null && intval($service['stock']) <= 0) {
                $db->rollBack();
                jsonResponse(['error' => 'Out of stock'], 400);
            }
            
            $saleType = ($service['sale_type'] ?? 'command') === 'stock' ? 'stock' : 'command';
            
            // For stock-type services, require an available product key BEFORE charging
            if ($saleType === 'stock') {
                $stmtChk = $db->prepare('SELECT COUNT(*) FROM tnsatbeltnd_product_keys WHERE service_id = ? AND status = "available"');
                $stmtChk->execute([$serviceId]);
                if (intval($stmtChk->fetchColumn()) <= 0) {
                    $db->rollBack();
                    // Log stock-out event for admin (best-effort, separate connection)
                    try {
                        $logDb = getDB();
                        $buyerName = $buyer['name'] ?? '—';
                        $svcName = $service['name'] ?? $serviceId;
                        $role = $resellerId ? 'Revendeur' : 'Client';
                        $msg = '🚫 Tentative d\'achat refusée (stock vide) — ' . $role . ': ' . $buyerName . ' | Produit: ' . $svcName;
                        $nid = bin2hex(random_bytes(16));
                        $logDb->prepare('INSERT INTO tnsatbeltnd_notifications (id, client_id, reseller_id, type, message, is_read) VALUES (?, NULL, NULL, ?, ?, 0)')
                              ->execute([$nid, 'stock_out_attempt', $msg]);
                        // Persist structured log row
                        $aid = bin2hex(random_bytes(16));
                        $logDb->prepare('INSERT INTO tnsatbeltnd_stock_out_attempts (id, service_id, client_id, reseller_id, attempted_credits) VALUES (?, ?, ?, ?, ?)')
                              ->execute([$aid, $serviceId, $clientId, $resellerId, $priceCredits]);
                    } catch (Exception $ignore) {}
                    jsonResponse([
                        'error' => 'Out of stock — no keys available',
                        'no_stock' => true,
                        'service_name' => $service['name'] ?? null,
                    ], 400);
                }
            }
            
            $orderId = bin2hex(random_bytes(16));
            $stmt = $db->prepare('INSERT INTO tnsatbeltnd_orders (id, client_id, reseller_id, service_id, credits_used, duration_months, status, delivery_type_id, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$orderId, $clientId, $resellerId, $serviceId, $priceCredits, $durationMonths, 'pending', $service['delivery_type_id'], $note ?: null]);
            
            $stmt = $db->prepare("UPDATE {$buyerTable} SET credits = credits - ? WHERE id = ?");
            $stmt->execute([$priceCredits, $buyerId]);
            
            if ($service['stock'] !== null) {
                $stmt = $db->prepare('UPDATE tnsatbeltnd_services SET stock = stock - 1 WHERE id = ?');
                $stmt->execute([$serviceId]);
            }

            $stmt = $db->prepare("SELECT credits FROM {$buyerTable} WHERE id = ?");
            $stmt->execute([$buyerId]);
            $updatedBuyer = $stmt->fetch();
            $txId = bin2hex(random_bytes(16));
            $stmt = $db->prepare('INSERT INTO tnsatbeltnd_point_transactions (id, client_id, reseller_id, type, amount, balance_after, description, order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$txId, $clientId, $resellerId, 'debit', $priceCredits, floatval($updatedBuyer['credits']), 'Achat: ' . $service['name'], $orderId]);
            
            // Auto-assign product key only when sale_type = 'stock'
            $autoFulfilled = false;
            $assignedCredentials = null;
            $availableKey = null;
            if ($saleType === 'stock') {
                $stmt = $db->prepare('SELECT id, fields FROM tnsatbeltnd_product_keys WHERE service_id = ? AND status = "available" ORDER BY created_at ASC LIMIT 1 FOR UPDATE');
                $stmt->execute([$serviceId]);
                $availableKey = $stmt->fetch();
            }
            
            if ($availableKey) {
                // Mark key as assigned (copy buyer's purchase note as initial reseller_note)
                $stmt = $db->prepare('UPDATE tnsatbeltnd_product_keys SET status = "assigned", order_id = ?, assigned_at = NOW(), reseller_note = ? WHERE id = ?');
                $stmt->execute([$orderId, $note ?: null, $availableKey['id']]);
                
                // Convert key fields to credentials format
                $keyFields = json_decode($availableKey['fields'], true);
                $credentials = [];
                if (is_array($keyFields)) {
                    foreach ($keyFields as $f) {
                        $credentials[$f['title']] = $f['value'];
                    }
                }
                $assignedCredentials = $credentials;
                
                // Auto-fulfill the order
                $stmt = $db->prepare('UPDATE tnsatbeltnd_orders SET credentials = ?, status = ?, fulfilled_at = NOW() WHERE id = ?');
                $stmt->execute([json_encode($credentials), 'fulfilled', $orderId]);
                $autoFulfilled = true;
                
                // Send notification to buyer
                $notifId = bin2hex(random_bytes(16));
                $serviceName = $service['name'] ?? '';
                $credLines = [];
                foreach ($credentials as $title => $value) {
                    $credLines[] = $title . ': ' . $value;
                }
                $notifMessage = !empty($credLines) ? implode("\n", $credLines) : 'Credentials ready! / Identifiants prêts !';
                $stmt = $db->prepare('INSERT INTO tnsatbeltnd_notifications (id, client_id, reseller_id, type, message, order_id, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)');
                $stmt->execute([$notifId, $clientId, $resellerId, 'credentials_ready', $notifMessage, $orderId]);
                
                // Low-stock admin notification
                $stmtRem = $db->prepare('SELECT COUNT(*) FROM tnsatbeltnd_product_keys WHERE service_id = ? AND status = "available"');
                $stmtRem->execute([$serviceId]);
                $remaining = intval($stmtRem->fetchColumn());
                if ($remaining === 0) {
                    $adminNotifId = bin2hex(random_bytes(16));
                    $stmt = $db->prepare('INSERT INTO tnsatbeltnd_notifications (id, client_id, reseller_id, type, message, order_id, is_read) VALUES (?, NULL, NULL, ?, ?, ?, 0)');
                    $stmt->execute([$adminNotifId, 'stock_empty', '⚠️ Stock épuisé pour "' . ($service['name'] ?? '') . '". Ajoutez de nouvelles clés.', $orderId]);
                }
            } else {
                // command-type OR (defensive) no key available → notify admin of new pending order
                $buyerName = $buyer['name'] ?? ($resellerId ? 'Reseller' : 'Client');
                $serviceName = $service['name'] ?? '';
                $adminMsg = '🛒 Nouvelle commande — ' . ($resellerId ? 'Revendeur' : 'Client') . ': ' . $buyerName . ' | Produit: ' . $serviceName;
                $adminNotifId = bin2hex(random_bytes(16));
                $stmt = $db->prepare('INSERT INTO tnsatbeltnd_notifications (id, client_id, reseller_id, type, message, order_id, is_read) VALUES (?, NULL, NULL, ?, ?, ?, 0)');
                $stmt->execute([$adminNotifId, 'new_order', $adminMsg, $orderId]);
            }
            
            $db->commit();
            
            jsonResponse([
                'id' => $orderId,
                'status' => $autoFulfilled ? 'fulfilled' : 'pending',
                'credits_remaining' => floatval($updatedBuyer['credits']),
                'auto_fulfilled' => $autoFulfilled,
                'credentials' => $assignedCredentials,
            ], 201);
        } catch (Exception $e) {
            $db->rollBack();
            jsonResponse(['error' => 'Order creation failed: ' . $e->getMessage()], 500);
        }
        break;

    case 'PUT':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        
        $body = getRequestBody();
        $db = getDB();
        
        if ($action === 'fulfill') {
            $credentials = $body['credentials'] ?? [];
            $stmt = $db->prepare('UPDATE tnsatbeltnd_orders SET credentials = ?, status = ?, fulfilled_at = NOW() WHERE id = ?');
            $stmt->execute([json_encode($credentials), 'fulfilled', $id]);
            
            $stmt = $db->prepare('SELECT client_id, reseller_id, service_id FROM tnsatbeltnd_orders WHERE id = ?');
            $stmt->execute([$id]);
            $order = $stmt->fetch();
            
            if ($order) {
                $stmt = $db->prepare('SELECT name FROM tnsatbeltnd_services WHERE id = ?');
                $stmt->execute([$order['service_id']]);
                $service = $stmt->fetch();
                
                $notifId = bin2hex(random_bytes(16));
                $serviceName = $service['name'] ?? '';
                $credLines = [];
                if (is_array($credentials)) {
                    foreach ($credentials as $title => $value) {
                        $credLines[] = $title . ': ' . $value;
                    }
                }
                $notifMessage = !empty($credLines) ? implode("\n", $credLines) : 'Credentials ready! / Identifiants prêts !';

                $stmt = $db->prepare('INSERT INTO tnsatbeltnd_notifications (id, client_id, reseller_id, type, message, order_id, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)');
                $stmt->execute([$notifId, $order['client_id'], $order['reseller_id'], 'credentials_ready', $notifMessage, $id]);
            }
            
            jsonResponse(['success' => true, 'status' => 'fulfilled']);
        } elseif ($action === 'reset_credentials') {
            $stmt = $db->prepare('UPDATE tnsatbeltnd_orders SET credentials = NULL, status = ?, fulfilled_at = NULL WHERE id = ?');
            $stmt->execute(['pending', $id]);
            jsonResponse(['success' => true, 'status' => 'pending']);
        } elseif ($action === 'cancel') {
            $db->beginTransaction();
            try {
                $stmt = $db->prepare('SELECT * FROM tnsatbeltnd_orders WHERE id = ? FOR UPDATE');
                $stmt->execute([$id]);
                $order = $stmt->fetch();
                if (!$order) { $db->rollBack(); jsonResponse(['error' => 'Order not found'], 404); }
                if ($order['status'] !== 'pending') { $db->rollBack(); jsonResponse(['error' => 'Only pending orders can be cancelled'], 400); }

                $creditsUsed = floatval($order['credits_used']);
                $clientId = $order['client_id'];
                $resellerId = $order['reseller_id'];

                if ($resellerId) { $buyerTable = 'tnsatbeltnd_resellers'; $buyerId = $resellerId; }
                else { $buyerTable = 'tnsatbeltnd_clients'; $buyerId = $clientId; }

                $stmt = $db->prepare("UPDATE {$buyerTable} SET credits = credits + ? WHERE id = ?");
                $stmt->execute([$creditsUsed, $buyerId]);

                $stmt = $db->prepare('SELECT stock FROM tnsatbeltnd_services WHERE id = ?');
                $stmt->execute([$order['service_id']]);
                $service = $stmt->fetch();
                if ($service && $service['stock'] !== null) {
                    $stmt = $db->prepare('UPDATE tnsatbeltnd_services SET stock = stock + 1 WHERE id = ?');
                    $stmt->execute([$order['service_id']]);
                }

                $stmt = $db->prepare('UPDATE tnsatbeltnd_orders SET status = ? WHERE id = ?');
                $stmt->execute(['cancelled', $id]);

                $stmt = $db->prepare("SELECT credits FROM {$buyerTable} WHERE id = ?");
                $stmt->execute([$buyerId]);
                $updated = $stmt->fetch();
                $txId = bin2hex(random_bytes(16));
                $stmt = $db->prepare('INSERT INTO tnsatbeltnd_point_transactions (id, client_id, reseller_id, type, amount, balance_after, description, order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([$txId, $clientId, $resellerId, 'credit', $creditsUsed, floatval($updated['credits']), 'Remboursement commande annulée', $id]);

                $notifId = bin2hex(random_bytes(16));
                $stmt = $db->prepare('INSERT INTO tnsatbeltnd_notifications (id, client_id, reseller_id, type, message, order_id, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)');
                $stmt->execute([$notifId, $clientId, $resellerId, 'order_cancelled', 'Your order has been cancelled and credits refunded. / Votre commande a été annulée et les crédits remboursés.', $id]);

                $db->commit();
                jsonResponse(['success' => true, 'status' => 'cancelled', 'credits_refunded' => $creditsUsed]);
            } catch (Exception $e) {
                $db->rollBack();
                jsonResponse(['error' => 'Cancel failed: ' . $e->getMessage()], 500);
            }
        } else {
            $status = $body['status'] ?? null;
            $credentials = $body['credentials'] ?? null;
            
            $updates = [];
            $params = [];
            if ($status) { $updates[] = 'status = ?'; $params[] = $status; }
            if ($credentials !== null) { $updates[] = 'credentials = ?'; $params[] = json_encode($credentials); }
            
            if (empty($updates)) {
                jsonResponse(['error' => 'No fields to update'], 400);
            }
            
            $params[] = $id;
            $stmt = $db->prepare('UPDATE tnsatbeltnd_orders SET ' . implode(', ', $updates) . ' WHERE id = ?');
            $stmt->execute($params);
            
            jsonResponse(['success' => true]);
        }
        break;

    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'ID required'], 400);
        $db = getDB();
        // Allow deleting fulfilled, cancelled, or resolved orders (not pending/disputed)
        $stmt = $db->prepare('DELETE FROM tnsatbeltnd_orders WHERE id = ? AND status IN (?, ?, ?)');
        $stmt->execute([$id, 'cancelled', 'fulfilled', 'resolved']);
        if ($stmt->rowCount() === 0) {
            jsonResponse(['error' => 'Cannot delete pending or disputed orders'], 400);
        }
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
