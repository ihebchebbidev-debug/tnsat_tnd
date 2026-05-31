<?php
/**
 * Image Upload API
 * 
 * POST /api/upload.php — Upload an image file
 * Returns the URL of the uploaded image
 */

require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

if (!isset($_FILES['image'])) {
    jsonResponse(['error' => 'No image file provided'], 400);
}

$file = $_FILES['image'];

// Check for upload errors
if ($file['error'] !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds form upload limit',
        UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
        UPLOAD_ERR_NO_FILE    => 'No file was uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing temp folder on server',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
    ];
    $msg = $errorMessages[$file['error']] ?? 'Unknown upload error';
    jsonResponse(['error' => $msg], 400);
}

// Validate file type
$allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
if (!in_array($file['type'], $allowedTypes)) {
    jsonResponse(['error' => 'Invalid file type. Allowed: JPG, PNG, GIF, WEBP'], 400);
}

$maxSize = 5 * 1024 * 1024; // 5MB
if ($file['size'] > $maxSize) {
    jsonResponse(['error' => 'File too large. Max 5MB'], 400);
}

// Ensure uploads directory (auto-creates on first upload)
$uploadsDir = ensureUploadsDir();

// Generate unique filename
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
    $ext = 'jpg'; // fallback
}
$filename = uniqid('img_', true) . '.' . $ext;
$filepath = $uploadsDir . '/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $filepath)) {
    jsonResponse(['error' => 'Failed to save file. Check server permissions.'], 500);
}

$imageUrl = getUploadUrl($filename);

jsonResponse([
    'success' => true,
    'url' => $imageUrl,
    'filename' => $filename
], 201);