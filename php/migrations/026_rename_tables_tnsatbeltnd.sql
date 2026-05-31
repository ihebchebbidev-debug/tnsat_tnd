-- Migration 026: Rename all tables from `tnsat_*` to `tnsatbeltnd_*`
-- Run this ONCE on the production MySQL database.
-- After running, all PHP APIs (already updated in code) will hit the new names.
--
-- Order doesn't matter for RENAME TABLE — MySQL resolves FKs by internal IDs.

RENAME TABLE
  tnsat_clients                       TO tnsatbeltnd_clients,
  tnsat_resellers                     TO tnsatbeltnd_resellers,
  tnsat_delivery_types                TO tnsatbeltnd_delivery_types,
  tnsat_services                      TO tnsatbeltnd_services,
  tnsat_orders                        TO tnsatbeltnd_orders,
  tnsat_complaints                    TO tnsatbeltnd_complaints,
  tnsat_notifications                 TO tnsatbeltnd_notifications,
  tnsat_point_transactions            TO tnsatbeltnd_point_transactions,
  tnsat_contact_messages              TO tnsatbeltnd_contact_messages,
  tnsat_recharge_codes                TO tnsatbeltnd_recharge_codes,
  tnsat_settings                      TO tnsatbeltnd_settings,
  tnsat_categories                    TO tnsatbeltnd_categories,
  tnsat_product_keys                  TO tnsatbeltnd_product_keys,
  tnsat_order_responses               TO tnsatbeltnd_order_responses,
  tnsat_global_messages               TO tnsatbeltnd_global_messages,
  tnsat_global_message_reads          TO tnsatbeltnd_global_message_reads,
  tnsat_stock_out_attempts            TO tnsatbeltnd_stock_out_attempts,
  tnsat_reseller_service_prices       TO tnsatbeltnd_reseller_service_prices,
  tnsat_reseller_service_visibility   TO tnsatbeltnd_reseller_service_visibility,
  tnsat_reseller_category_visibility  TO tnsatbeltnd_reseller_category_visibility,
  tnsat_reset_products                TO tnsatbeltnd_reset_products;
