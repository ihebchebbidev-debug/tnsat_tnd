<?php
/**
 * Stock Out Attempts API (admin)
 * GET /stock-out-attempts.php
 *   Optional filters: ?service_id=xxx & reseller_id=xxx & client_id=xxx
 *                     & buyer_type=reseller|client & from=YYYY-MM-DD & to=YYYY-MM-DD
 *                     & page=1 & limit=20
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);

$db = getDB();

$serviceId  = $_GET['service_id']  ?? null;
$resellerId = $_GET['reseller_id'] ?? null;
$clientId   = $_GET['client_id']   ?? null;
$buyerType  = $_GET['buyer_type']  ?? null;
$from       = $_GET['from']        ?? null;
$to         = $_GET['to']          ?? null;
$page       = isset($_GET['page'])  ? max(1, intval($_GET['page'])) : 1;
$limit      = isset($_GET['limit']) ? max(1, min(200, intval($_GET['limit']))) : 50;
$offset     = ($page - 1) * $limit;

$conds = [];
$params = [];
if ($serviceId)  { $conds[] = 'a.service_id = ?';  $params[] = $serviceId; }
if ($resellerId) { $conds[] = 'a.reseller_id = ?'; $params[] = $resellerId; }
if ($clientId)   { $conds[] = 'a.client_id = ?';   $params[] = $clientId; }
if ($buyerType === 'reseller') $conds[] = 'a.reseller_id IS NOT NULL';
if ($buyerType === 'client')   $conds[] = 'a.client_id IS NOT NULL';
if ($from) { $conds[] = 'a.created_at >= ?'; $params[] = $from . ' 00:00:00'; }
if ($to)   { $conds[] = 'a.created_at <= ?'; $params[] = $to . ' 23:59:59'; }
$where = $conds ? ' WHERE ' . implode(' AND ', $conds) : '';

$baseFrom = '
    FROM tnsatbeltnd_stock_out_attempts a
    LEFT JOIN tnsatbeltnd_services s  ON a.service_id  = s.id
    LEFT JOIN tnsatbeltnd_clients c   ON a.client_id   = c.id
    LEFT JOIN tnsatbeltnd_resellers r ON a.reseller_id = r.id
';

$countStmt = $db->prepare("SELECT COUNT(*) {$baseFrom}{$where}");
$countStmt->execute($params);
$total = intval($countStmt->fetchColumn());

$sql = "SELECT a.id, a.service_id, a.client_id, a.reseller_id,
               a.attempted_credits, a.created_at,
               s.name AS service_name,
               COALESCE(c.name, r.name, '—') AS buyer_name,
               COALESCE(c.email, r.email, '') AS buyer_email,
               CASE WHEN a.reseller_id IS NOT NULL THEN 'reseller'
                    WHEN a.client_id   IS NOT NULL THEN 'client'
                    ELSE 'unknown' END AS buyer_type
        {$baseFrom}{$where}
        ORDER BY a.created_at DESC LIMIT {$limit} OFFSET {$offset}";

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();
foreach ($rows as &$r) {
    $r['attempted_credits'] = floatval($r['attempted_credits']);
}

jsonResponse([
    'data' => $rows,
    'total' => $total,
    'page' => $page,
    'limit' => $limit,
]);
