-- Migration 013: Order responses — resellers respond to fulfilled orders with their info
-- When admin fulfills an order, reseller can open the notification and add their details

CREATE TABLE IF NOT EXISTS tnsatbeltnd_order_responses (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    reseller_id VARCHAR(64) DEFAULT NULL,
    client_id VARCHAR(64) DEFAULT NULL,
    response_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES tnsatbeltnd_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES tnsatbeltnd_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_order_responses_order ON tnsatbeltnd_order_responses(order_id);
CREATE INDEX idx_order_responses_reseller ON tnsatbeltnd_order_responses(reseller_id);
