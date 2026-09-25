#![no_std]

//! SpendingVault — treasury de reembolsos con límite de gasto forzado on-chain.
//!
//! El backend de Vera ya no firma un pago clásico con la llave completa del
//! treasury; en su lugar invoca `release_payment` con una llave "operadora"
//! cuyo poder está acotado por este contrato: solo puede pagar a wallets
//! registradas (`register_employee`), y nunca más del límite asignado a esa
//! wallet. Si la llave operadora se filtra, el daño máximo es "gastar hasta
//! el límite de cada empleado registrado", no "vaciar el treasury completo".
//!
//! Lo que este contrato NO hace: no evalúa si un gasto individual es
//! legítimo (eso sigue siendo Jev + reglas, fuera de la cadena). Solo pone un
//! techo duro, inmutable mientras corre, a cuánto puede salir y hacia dónde.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, Env, Map,
};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentReleased {
    #[topic]
    pub employee: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmployeeCap {
    /// Tope de vida del contrato para este empleado, en unidades mínimas del token (7 decimales para USDC).
    pub limit: i128,
    /// Cuánto se le ha pagado ya a este empleado desde que se registró.
    pub spent: i128,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Operator,
    Token,
    Employees,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    EmployeeNotRegistered = 3,
    LimitExceeded = 4,
    InvalidAmount = 5,
}

#[contract]
pub struct SpendingVault;

#[contractimpl]
impl SpendingVault {
    /// Se llama una sola vez, justo después de desplegar. `admin` gobierna
    /// altas de empleados y rotación del operador; `operator` es la llave
    /// que el backend usa día a día para pagar; `token` es el contrato del
    /// asset (el SAC de USDC en testnet).
    pub fn initialize(env: Env, admin: Address, operator: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, VaultError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Operator, &operator);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage()
            .instance()
            .set(&DataKey::Employees, &Map::<Address, EmployeeCap>::new(&env));
    }

    /// Rota la llave operadora (ej. si se sospecha que se filtró) sin tocar
    /// los topes ya registrados. Requiere la firma del admin.
    pub fn set_operator(env: Env, new_operator: Address) {
        let admin = Self::require_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Operator, &new_operator);
    }

    /// Da de alta (o actualiza el tope de) una wallet de empleado. Solo el
    /// admin puede hacerlo — el operador nunca puede agregar destinos nuevos
    /// por su cuenta, ni subir su propio límite.
    pub fn register_employee(env: Env, employee: Address, limit: i128) {
        let admin = Self::require_admin(&env);
        admin.require_auth();
        if limit < 0 {
            panic_with_error!(&env, VaultError::InvalidAmount);
        }

        let mut employees = Self::employees(&env);
        let spent = employees.get(employee.clone()).map(|c| c.spent).unwrap_or(0);
        employees.set(employee, EmployeeCap { limit, spent });
        env.storage().instance().set(&DataKey::Employees, &employees);
    }

    /// Quita a un empleado del registro — cualquier intento posterior de
    /// pagarle con `release_payment` falla.
    pub fn remove_employee(env: Env, employee: Address) {
        let admin = Self::require_admin(&env);
        admin.require_auth();
        let mut employees = Self::employees(&env);
        employees.remove(employee);
        env.storage().instance().set(&DataKey::Employees, &employees);
    }

    /// El único camino para que salga dinero del vault. Requiere la firma
    /// del operador (no del admin) — así el backend puede pagar sin tener
    /// nunca la llave que puede registrar wallets nuevas o subir límites.
    /// Revierte si la wallet no está registrada o si excede su tope.
    pub fn release_payment(env: Env, employee: Address, amount: i128) {
        let operator: Address = env
            .storage()
            .instance()
            .get(&DataKey::Operator)
            .unwrap_or_else(|| panic_with_error!(&env, VaultError::NotInitialized));
        operator.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, VaultError::InvalidAmount);
        }

        let mut employees = Self::employees(&env);
        let mut cap = employees
            .get(employee.clone())
            .unwrap_or_else(|| panic_with_error!(&env, VaultError::EmployeeNotRegistered));

        let new_spent = cap.spent + amount;
        if new_spent > cap.limit {
            panic_with_error!(&env, VaultError::LimitExceeded);
        }
        cap.spent = new_spent;
        employees.set(employee.clone(), cap);
        env.storage().instance().set(&DataKey::Employees, &employees);

        let token_id: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_id);
        token_client.transfer(&env.current_contract_address(), &employee, &amount);

        PaymentReleased { employee, amount }.publish(&env);
    }

    /// Balance actual del vault en el token configurado (USDC testnet).
    pub fn balance(env: Env) -> i128 {
        let token_id: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token_id).balance(&env.current_contract_address())
    }

    /// Tope y gasto acumulado de un empleado, o `None` si no está registrado.
    pub fn get_cap(env: Env, employee: Address) -> Option<EmployeeCap> {
        Self::employees(&env).get(employee)
    }

    fn require_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, VaultError::NotInitialized))
    }

    fn employees(env: &Env) -> Map<Address, EmployeeCap> {
        env.storage()
            .instance()
            .get(&DataKey::Employees)
            .unwrap_or_else(|| panic_with_error!(env, VaultError::NotInitialized))
    }
}

mod test;
