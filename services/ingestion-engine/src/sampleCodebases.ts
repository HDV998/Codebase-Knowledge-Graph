import { ParsedFileResult } from './types';
import { CodeParser } from './parser';

export interface SampleRepoDefinition {
  id: string;
  name: string;
  description: string;
  branch: string;
  files: { path: string; content: string }[];
}

export const SAMPLE_CODEBASES: SampleRepoDefinition[] = [
  {
    id: 'ecommerce-payment-platform',
    name: 'E-Commerce & Payment Microservice Platform',
    description: 'Multi-tiered checkout pipeline with Stripe integration, inventory reservation, tax calculation, and notification dispatchers.',
    branch: 'main',
    files: [
      {
        path: 'src/services/OrderService.ts',
        content: `
import { processPayment, refundPayment } from './PaymentProcessor';
import { checkStock, reserveInventory, releaseInventory } from './InventoryService';
import { calculateTax } from '../utils/TaxCalculator';
import { sendOrderConfirmation, sendFailureAlert } from './NotificationClient';
import { validateUserSession } from '../auth/AuthGuard';

export interface OrderPayload {
  orderId: string;
  userId: string;
  items: Array<{ id: string; price: number; quantity: number }>;
  paymentMethodId: string;
  shippingAddress: string;
}

export class OrderService {
  public async createOrder(payload: OrderPayload): Promise<{ success: boolean; transactionId?: string }> {
    const isAuthorized = await validateUserSession(payload.userId);
    if (!isAuthorized) {
      throw new Error("Unauthorized user transaction");
    }

    const inStock = await checkStock(payload.items);
    if (!inStock) {
      await sendFailureAlert(payload.userId, "Out of stock");
      return { success: false };
    }

    await reserveInventory(payload.orderId, payload.items);
    const subtotal = payload.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const tax = await calculateTax(subtotal, payload.shippingAddress);
    const totalAmount = subtotal + tax;

    try {
      const paymentResult = await processPayment(payload.orderId, totalAmount, payload.paymentMethodId);
      if (paymentResult.success) {
        await sendOrderConfirmation(payload.orderId, payload.userId, totalAmount);
        return { success: true, transactionId: paymentResult.transactionId };
      } else {
        await releaseInventory(payload.orderId);
        await sendFailureAlert(payload.userId, "Payment declined");
        return { success: false };
      }
    } catch (error) {
      await releaseInventory(payload.orderId);
      throw error;
    }
  }

  public async cancelOrder(orderId: string, transactionId: string): Promise<boolean> {
    await releaseInventory(orderId);
    const refunded = await refundPayment(transactionId);
    return refunded;
  }
}
        `
      },
      {
        path: 'src/services/PaymentProcessor.ts',
        content: `
import { chargeCard, createStripeRefund, tokenizePaymentMethod } from '../integrations/StripeGateway';
import { logDatabaseTransaction } from '../db/DatabasePool';

export async function processPayment(orderId: string, amount: number, paymentMethodId: string): Promise<{ success: boolean; transactionId: string }> {
  const token = await tokenizePaymentMethod(paymentMethodId);
  const charge = await chargeCard(amount, token);
  await logDatabaseTransaction(orderId, "PAYMENT_PROCESSED", amount);
  return {
    success: charge.status === 'succeeded',
    transactionId: charge.id
  };
}

export async function refundPayment(transactionId: string): Promise<boolean> {
  const refund = await createStripeRefund(transactionId);
  await logDatabaseTransaction(transactionId, "PAYMENT_REFUNDED", 0);
  return refund.status === 'succeeded';
}
        `
      },
      {
        path: 'src/integrations/StripeGateway.ts',
        content: `
import { getSecretKey } from '../config/SecretVault';

export async function chargeCard(amountCents: number, token: string): Promise<{ id: string; status: string }> {
  const apiKey = await getSecretKey("STRIPE_SECRET_KEY");
  if (!apiKey) throw new Error("Stripe secret key missing");
  // External Stripe API invocation simulation
  return {
    id: "ch_" + Math.random().toString(36).substring(7),
    status: "succeeded"
  };
}

export async function tokenizePaymentMethod(cardToken: string): Promise<string> {
  return "tok_" + cardToken;
}

export async function createStripeRefund(chargeId: string): Promise<{ status: string }> {
  const apiKey = await getSecretKey("STRIPE_SECRET_KEY");
  return { status: "succeeded" };
}
        `
      },
      {
        path: 'src/services/InventoryService.ts',
        content: `
import { queryDatabase, executeTransaction } from '../db/DatabasePool';

export async function checkStock(items: Array<{ id: string; quantity: number }>): Promise<boolean> {
  for (const item of items) {
    const row = await queryDatabase("SELECT stock FROM inventory WHERE item_id = ?", [item.id]);
    if (!row || row.stock < item.quantity) return false;
  }
  return true;
}

export async function reserveInventory(orderId: string, items: Array<{ id: string; quantity: number }>): Promise<void> {
  await executeTransaction("UPDATE inventory SET stock = stock - ? WHERE item_id = ?", items);
}

export async function releaseInventory(orderId: string): Promise<void> {
  await executeTransaction("UPDATE inventory SET stock = stock + ? WHERE reservation_order_id = ?", [orderId]);
}
        `
      },
      {
        path: 'src/utils/TaxCalculator.ts',
        content: `
export async function calculateTax(subtotal: number, stateOrZip: string): Promise<number> {
  const rate = getRegionalTaxRate(stateOrZip);
  return subtotal * rate;
}

export function getRegionalTaxRate(region: string): number {
  if (region.includes("CA")) return 0.0825;
  if (region.includes("NY")) return 0.08875;
  if (region.includes("WA")) return 0.065;
  return 0.05;
}
        `
      },
      {
        path: 'src/services/NotificationClient.ts',
        content: `
import { sendEmailTemplate } from '../integrations/EmailService';

export async function sendOrderConfirmation(orderId: string, userId: string, amount: number): Promise<void> {
  await sendEmailTemplate(userId, "ORDER_CONFIRMATION", { orderId, amount });
}

export async function sendFailureAlert(userId: string, reason: string): Promise<void> {
  await sendEmailTemplate(userId, "TRANSACTION_FAILED", { reason });
}
        `
      },
      {
        path: 'src/integrations/EmailService.ts',
        content: `
import { getSecretKey } from '../config/SecretVault';

export async function sendEmailTemplate(recipient: string, templateId: string, data: any): Promise<boolean> {
  const smtpKey = await getSecretKey("SENDGRID_API_KEY");
  return true;
}
        `
      },
      {
        path: 'src/auth/AuthGuard.ts',
        content: `
import { verifyJwtToken, extractUserId } from './JwtManager';

export async function validateUserSession(tokenOrUserId: string): Promise<boolean> {
  const isValid = await verifyJwtToken(tokenOrUserId);
  return isValid;
}
        `
      },
      {
        path: 'src/auth/JwtManager.ts',
        content: `
import { getSecretKey } from '../config/SecretVault';

export async function verifyJwtToken(token: string): Promise<boolean> {
  const secret = await getSecretKey("JWT_SIGNING_KEY");
  return token.length > 5;
}

export function extractUserId(token: string): string {
  return "user_" + token.substring(0, 4);
}
        `
      },
      {
        path: 'src/db/DatabasePool.ts',
        content: `
export async function queryDatabase(sql: string, params: any[]): Promise<any> {
  return { stock: 100 };
}

export async function executeTransaction(sql: string, params: any[]): Promise<void> {
  return;
}

export async function logDatabaseTransaction(orderId: string, event: string, amount: number): Promise<void> {
  await executeTransaction("INSERT INTO audit_log (order_id, event, amount) VALUES (?, ?, ?)", [orderId, event, amount]);
}
        `
      },
      {
        path: 'src/config/SecretVault.ts',
        content: `
export async function getSecretKey(keyName: string): Promise<string> {
  return "vault_secret_" + keyName.toLowerCase();
}
        `
      },
      {
        path: 'tests/OrderService.test.ts',
        content: `
import { OrderService } from '../src/services/OrderService';
import { processPayment } from '../src/services/PaymentProcessor';
import { reserveInventory } from '../src/services/InventoryService';

describe('OrderService Pipeline Tests', () => {
  it('should successfully create order and charge payment', async () => {
    const service = new OrderService();
    const res = await service.createOrder({
      orderId: 'ord_123',
      userId: 'usr_abc',
      items: [{ id: 'prod_1', price: 50, quantity: 2 }],
      paymentMethodId: 'pm_card_visa',
      shippingAddress: 'San Francisco, CA'
    });
  });

  it('should cancel order and refund payment on rollback', async () => {
    const service = new OrderService();
    await service.cancelOrder('ord_123', 'ch_999');
  });
});
        `
      },
      {
        path: 'tests/PaymentProcessor.test.ts',
        content: `
import { processPayment, refundPayment } from '../src/services/PaymentProcessor';

describe('PaymentProcessor Test Suite', () => {
  it('should process payment through stripe gateway', async () => {
    const res = await processPayment('ord_456', 100, 'pm_test');
  });

  it('should refund transaction properly', async () => {
    const res = await refundPayment('ch_test_123');
  });
});
        `
      }
    ]
  },
  {
    id: 'auth-identity-rbac-service',
    name: 'Authentication & RBAC Identity Service',
    description: 'Enterprise OAuth2, JWT verification, password hashing, and role-based access control engine.',
    branch: 'main',
    files: [
      {
        path: 'src/controllers/AuthController.py',
        content: `
from services.TokenService import generate_access_token, verify_token
from services.UserService import authenticate_user, register_new_user
from security.AuditLogger import log_security_event

class AuthController:
    def login(self, username, password):
        user = authenticate_user(username, password)
        if not user:
            log_security_event(username, "LOGIN_FAILED")
            return {"error": "Invalid credentials"}
        
        token = generate_access_token(user["id"], user["roles"])
        log_security_event(username, "LOGIN_SUCCESS")
        return {"token": token, "user": user}

    def register(self, email, password, role="viewer"):
        user = register_new_user(email, password, role)
        log_security_event(email, "USER_REGISTERED")
        return user
        `
      },
      {
        path: 'src/services/UserService.py',
        content: `
from security.PasswordHasher import hash_password, verify_password
from db.UserRepository import find_user_by_email, save_user

def authenticate_user(email, password):
    user = find_user_by_email(email)
    if not user:
        return None
    if verify_password(password, user["password_hash"]):
        return user
    return None

def register_new_user(email, password, role):
    p_hash = hash_password(password)
    user_id = save_user(email, p_hash, role)
    return {"id": user_id, "email": email, "role": role}
        `
      },
      {
        path: 'src/services/TokenService.py',
        content: `
import jwt
from config.SecurityConfig import get_jwt_secret

def generate_access_token(user_id, roles):
    secret = get_jwt_secret()
    payload = {"sub": user_id, "roles": roles, "exp": 3600}
    return jwt.encode(payload, secret, algorithm="HS256")

def verify_token(token):
    secret = get_jwt_secret()
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return payload
    except Exception:
        return None
        `
      },
      {
        path: 'src/security/PasswordHasher.py',
        content: `
import bcrypt

def hash_password(plain_password):
    salt = bcrypt.gensalt(12)
    return bcrypt.hashpw(plain_password.encode('utf-8'), salt)

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)
        `
      },
      {
        path: 'src/security/AuditLogger.py',
        content: `
from db.AuditRepository import record_audit_entry

def log_security_event(identifier, event_type):
    record_audit_entry(identifier, event_type)
        `
      },
      {
        path: 'src/db/UserRepository.py',
        content: `
def find_user_by_email(email):
    return {"id": "usr_99", "email": email, "password_hash": b"secret", "roles": ["admin"]}

def save_user(email, password_hash, role):
    return "usr_" + email.split("@")[0]
        `
      },
      {
        path: 'src/config/SecurityConfig.py',
        content: `
def get_jwt_secret():
    return "production_vault_secret_key_3874623"
        `
      },
      {
        path: 'src/db/AuditRepository.py',
        content: `
def record_audit_entry(user, event):
    pass
        `
      },
      {
        path: 'tests/test_auth_service.py',
        content: `
from services.UserService import authenticate_user, register_new_user
from security.PasswordHasher import hash_password, verify_password

def test_authenticate_user_success():
    user = authenticate_user("admin@corp.io", "password123")

def test_password_hashing():
    hashed = hash_password("mypassword")
    assert verify_password("mypassword", hashed)
        `
      }
    ]
  }
];

/**
 * Load and parse sample codebases into KnowledgeGraphData objects
 */
export function loadSampleCodebaseGraph(repoId: string) {
  const repoDef = SAMPLE_CODEBASES.find(r => r.id === repoId);
  if (!repoDef) throw new Error("Unknown sample repository.");
  const parser = new CodeParser(repoDef.id);
  const parsedResults: ParsedFileResult[] = [];

  for (const file of repoDef.files) {
    const res = parser.parseFile(file.path, file.content);
    parsedResults.push(res);
  }

  const { GraphBuilder } = require('./graphBuilder');
  const builder = new GraphBuilder(repoDef.id, repoDef.branch, `https://github.com/enterprise/${repoDef.id}`);
  return builder.buildGraph(parsedResults);
}
