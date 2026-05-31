# Reset Products — installation

Run on MySQL **once** to enable the new "Reset Codes" catalog:

```bash
mysql -u <user> -p <database> < php/migrations/014_reset_products.sql
```

This creates `tnsatbeltnd_reset_products` and seeds 3 example products
(IPTV Active Code, Xtream IPTV, M3U / Playlist).

The new endpoint is exposed at:

```
/api/reset-products.php
```

It is consumed by:
- Admin Dashboard → "Reset Codes" tab → "Reset products" section (CRUD)
- Reseller Dashboard → "Reset Codes" tab (browse + request)

No other backend changes are required: reset requests are stored in the
existing `tnsatbeltnd_notifications` table with `type = 'reset_request'`,
which the admin queue already consumes.
