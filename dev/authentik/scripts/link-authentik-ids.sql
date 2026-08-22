-- Generated for USER_UUID sub_mode (Authentik JWT "sub" = user UUID)
-- Apply: psql -h localhost -U postgres -d clinic_hms -f link-authentik-ids.sql
UPDATE users SET authentik_user_id = 'd561ba58-89c4-4d0c-bad0-15f81b2e1771', updated_at = NOW() WHERE mobile = '9999999999';
UPDATE users SET authentik_user_id = '626e983b-da80-459d-9fc7-427c29f29881', updated_at = NOW() WHERE mobile = '8888888888';
UPDATE users SET authentik_user_id = 'd3cfa0ca-921a-4bea-b78b-2220815bdd2a', updated_at = NOW() WHERE mobile = '7777777777';
UPDATE users SET authentik_user_id = '2c314ec0-626b-45ba-aece-7e50949d5de0', updated_at = NOW() WHERE mobile = '6666666666';
UPDATE users SET authentik_user_id = '44e8d205-77b1-4fff-8d57-84b6de446386', updated_at = NOW() WHERE mobile = '5555555555';
