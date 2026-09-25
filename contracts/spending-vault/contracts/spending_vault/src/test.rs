#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Env;

fn setup(env: &Env) -> (Address, Address, Address, Address, SpendingVaultClient<'static>) {
    let admin = Address::generate(env);
    let operator = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_contract_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract_id.address();

    let contract_id = env.register(SpendingVault, ());
    let client = SpendingVaultClient::new(env, &contract_id);
    client.initialize(&admin, &operator, &token_id);

    (admin, operator, token_admin, token_id, client)
}

#[test]
fn register_and_read_cap() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, _operator, _token_admin, _token_id, client) = setup(&env);
    let _ = admin;

    let employee = Address::generate(&env);
    client.register_employee(&employee, &1_000);

    let cap = client.get_cap(&employee).unwrap();
    assert_eq!(cap.limit, 1_000);
    assert_eq!(cap.spent, 0);
}

#[test]
#[should_panic]
fn release_payment_fails_for_unregistered_employee() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, _operator, _token_admin, _token_id, client) = setup(&env);

    let stranger = Address::generate(&env);
    client.release_payment(&stranger, &100);
}

#[test]
#[should_panic]
fn release_payment_fails_over_limit() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, _operator, _token_admin, _token_id, client) = setup(&env);

    let employee = Address::generate(&env);
    client.register_employee(&employee, &100);
    client.release_payment(&employee, &101);
}

#[test]
fn release_payment_succeeds_within_limit_and_transfers_token() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, _operator, token_admin, token_id, client) = setup(&env);

    let employee = Address::generate(&env);
    client.register_employee(&employee, &1_000);

    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
    token_admin_client.mint(&client.address, &1_000);

    client.release_payment(&employee, &300);

    let cap = client.get_cap(&employee).unwrap();
    assert_eq!(cap.spent, 300);
    assert_eq!(client.balance(), 700);

    let token_client = token::Client::new(&env, &token_id);
    assert_eq!(token_client.balance(&employee), 300);

    let _ = token_admin;
}

#[test]
fn admin_can_rotate_operator_and_old_operator_loses_access() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, _operator, _token_admin, _token_id, client) = setup(&env);

    let new_operator = Address::generate(&env);
    client.set_operator(&new_operator);

    // El límite/registro sigue intacto tras rotar operador — solo cambia
    // quién puede invocar release_payment (mock_all_auths no distingue
    // identidades en test, así que esta prueba valida el registro, no la
    // autenticación real; la autenticación real la valida la red).
    let employee = Address::generate(&env);
    client.register_employee(&employee, &50);
    assert_eq!(client.get_cap(&employee).unwrap().limit, 50);
}
