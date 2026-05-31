-- Insert XTREAM IPTV products
INSERT INTO tnsatbeltnd_services (id, name, description, image_url, price_tnd, price_credits, stock, category, created_at) VALUES
(HEX(RANDOM_BYTES(16)), 'M3U ES-IPTV PRO+ 12 MOIS ON-DEMAND', '.', 'https://fastpro.ovh/storage/assets/img/produits/1716491680.jpg', 0, 0, NULL, 'XTREAM IPTV', NOW()),
(HEX(RANDOM_BYTES(16)), 'SONIC TV DIWEN 12MOIS', 'http://z2.sonic4k.xyz:2052/', 'https://fastpro.ovh/storage/assets/img/produits/1742055051.jpg', 0, 0, NULL, 'XTREAM IPTV', NOW()),
(HEX(RANDOM_BYTES(16)), 'SONIC TV 12 MOIS', 'http://z2.sonic4k.xyz:2052/', 'https://fastpro.ovh/storage/assets/img/produits/1716491350.jpg', 0, 0, NULL, 'XTREAM IPTV', NOW()),
(HEX(RANDOM_BYTES(16)), 'PRO-IPTV 12 MOIS', 'Server:Port --> http://proiptv.tn:1234', 'https://fastpro.ovh/storage/assets/img/produits/1716490885.jpg', 0, 0, NULL, 'XTREAM IPTV', NOW()),
(HEX(RANDOM_BYTES(16)), 'PRINCE TV PRO 12MOIS', 'http://abc123.ovh:7355/', 'https://fastpro.ovh/storage/assets/img/produits/1716490985.jpg', 0, 0, NULL, 'XTREAM IPTV', NOW()),
(HEX(RANDOM_BYTES(16)), 'PRINCE TV PRO 6MOIS', 'http://abc123.ovh:7355/', 'https://fastpro.ovh/storage/assets/img/produits/1716491016.jpg', 0, 0, NULL, 'XTREAM IPTV', NOW()),
(HEX(RANDOM_BYTES(16)), 'MMTV IPTV 12 MOIS', 'URL = http://25.mmsto.xyz:80', 'https://fastpro.ovh/storage/assets/img/produits/1716491150.jpg', 0, 0, NULL, 'XTREAM IPTV', NOW()),
(HEX(RANDOM_BYTES(16)), 'MMTV IPTV 6 MOIS', 'URL = http://25.mmsto.xyz:80', 'https://fastpro.ovh/storage/assets/img/produits/1716491183.jpg', 0, 0, NULL, 'XTREAM IPTV', NOW());
