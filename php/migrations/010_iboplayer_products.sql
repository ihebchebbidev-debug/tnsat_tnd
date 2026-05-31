-- Insert IBOPLAYER products
INSERT INTO tnsatbeltnd_services (id, name, description, image_url, price_tnd, price_credits, stock, category, created_at) VALUES
(HEX(RANDOM_BYTES(16)), 'IBOPLAYER 12 MOIS', '.', 'https://fastpro.ovh/storage/assets/img/produits/1716493644.jpg', 0, 0, NULL, 'IBOPLAYER', NOW()),
(HEX(RANDOM_BYTES(16)), 'IBOPLAYER LIFETIME', '.', 'https://fastpro.ovh/storage/assets/img/produits/1716493694.jpg', 0, 0, NULL, 'IBOPLAYER', NOW()),
(HEX(RANDOM_BYTES(16)), 'IBO PRO 12 MOIS', '.', 'https://fastpro.ovh/storage/assets/img/produits/1716493762.jpg', 0, 0, NULL, 'IBOPLAYER', NOW()),
(HEX(RANDOM_BYTES(16)), 'IBO PRO LIFETIME', '.', 'https://fastpro.ovh/storage/assets/img/produits/1716493807.jpg', 0, 0, NULL, 'IBOPLAYER', NOW());
