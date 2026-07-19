/*
 * Admin.ts — Mongoose model for admin panel users.
 *
 * MPD Task DB-04:
 *   "Mongoose model for Admin. Fields: email, passwordHash, name,
 *   role, lastLoginAt. Password hashed with bcryptjs.
 *   Indexed on email (unique)."
 *
 * MPD Section 8, Technical Architecture — Admin Auth:
 *   "Admin authentication: email + password (bcryptjs hash, cost 12).
 *   Session management: iron-session (cookie-based, encrypted).
 *   Single admin user for V1 (the founder). Role field reserved for
 *   future multi-admin expansion."
 *
 * MPD Section 5.5, Admin Panel:
 *   "Login page: email + password form. Session persists for 7 days.
 *   No public registration — admin accounts created via seed script."
 *
 * SECURITY MODEL:
 *   Passwords are NEVER stored in plaintext.
 *   bcryptjs hashes passwords with cost factor 12 (recommended for 2024+).
 *   Cost 12 takes ~250ms per hash on modern hardware — slow enough to
 *   resist brute-force attacks, fast enough for login UX.
 *
 *   The passwordHash field is NEVER returned in API responses.
 *   The toJSON transform (defined in schema options) removes passwordHash
 *   from all JSON serialisations, preventing accidental exposure.
 *
 * ROLES (V1):
 *   'superadmin': full access — create/edit/delete bikes and brands,
 *                 manage other admins (future Phase 10+)
 *   'editor':     create/edit bikes and publish — cannot manage admins
 *                 or delete published content (future Phase 10+)
 *   V1 only creates superadmin accounts via the seed script.
 *
 * IRON-SESSION INTEGRATION (A-03):
 *   After password verification, the Admin document's _id and email
 *   are stored in the iron-session cookie:
 *     session.admin = { id: admin._id.toString(), email: admin.email }
 *   The session is read on every admin request via middleware (A-04).
 *
 * INSTANCE METHODS:
 *   verifyPassword(plaintext) — compares plaintext against passwordHash.
 *     Returns true if the password matches.
 *     Static (not async on the schema) because bcrypt.compare is async.
 *
 * STATIC METHODS:
 *   hashPassword(plaintext) — hashes a plaintext password.
 *     Used by the seed script (DB-10) and the admin creation route.
 *     Exported as a standalone function for use outside Mongoose context.
 *
 * SINGLETON PATTERN:
 *   Same mongoose.models guard as Bike.ts (DB-02) and Brand.ts (DB-03).
 *
 * WHY bcryptjs (not bcrypt):
 *   bcrypt requires native Node.js bindings (node-gyp).
 *   bcryptjs is a pure JavaScript implementation — no native build step.
 *   Performance is slightly slower but negligible for a low-volume admin
 *   login endpoint. bcryptjs was installed in Phase 1 (S-09).
 */

import mongoose, {
    type Document,
    type Model,
    Schema,
  } from 'mongoose'
  import bcryptjs from 'bcryptjs'
  
  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  
  /*
   * BCRYPT_COST — the work factor for bcryptjs password hashing.
   * Cost 12 = 2^12 = 4096 iterations per hash.
   * At cost 12, hashing takes ~250ms on modern hardware.
   * This is the 2024 OWASP recommended minimum for bcrypt.
   * Increase to 13 or 14 on more powerful production servers.
   */
  const BCRYPT_COST = 12
  
  /*
   * ADMIN_ROLES — the set of valid role strings.
   * Defined as a const array so both the schema enum and the
   * TypeScript union type derive from the same source of truth.
   */
  const ADMIN_ROLES = ['superadmin', 'editor'] as const
  
  /*
   * AdminRole — TypeScript union type derived from ADMIN_ROLES.
   * Used to type the role field on IAdmin and IAdminInput.
   */
  export type AdminRole = (typeof ADMIN_ROLES)[number]
  
  // ---------------------------------------------------------------------------
  // Interfaces
  // ---------------------------------------------------------------------------
  
  /*
   * IAdmin — TypeScript interface for an Admin Mongoose document.
   * Extends Document to include Mongoose instance methods and virtuals.
   *
   * IMPORTANT: passwordHash is included here for the Mongoose schema
   * but is stripped from all JSON responses via the toJSON transform.
   * Never send passwordHash to the client.
   */
  export interface IAdmin extends Document {
    /*
     * email — the admin's login email address.
     * Stored lowercase. Used as the primary login identifier.
     * Must be unique across all admin accounts.
     * Example: "founder@motohub360.in"
     */
    email: string
  
    /*
     * passwordHash — bcryptjs hash of the admin's password.
     * NEVER returned in API responses (stripped by toJSON transform).
     * Cost factor: BCRYPT_COST (12).
     * Format: "$2a$12$[22-char salt][31-char hash]"
     */
    passwordHash: string
  
    /*
     * name — the admin's display name.
     * Shown in the admin panel header and audit logs (future).
     * Example: "Balakrishna Sethuraman"
     */
    name: string
  
    /*
     * role — the admin's permission level.
     * 'superadmin': full access
     * 'editor': content management only
     * Default: 'superadmin' for V1 (single founder admin).
     */
    role: AdminRole
  
    /*
     * lastLoginAt — timestamp of the most recent successful login.
     * Updated on every successful authentication (A-03).
     * Null for accounts that have never logged in.
     * Used for security audit trail.
     */
    lastLoginAt: Date | null
  
    /*
     * isActive — whether this admin account can log in.
     * Inactive accounts: authentication fails immediately.
     * Allows disabling access without deleting the account.
     * Default: true
     */
    isActive: boolean
  
    // ── Timestamps (auto-managed by Mongoose) ──────────────────────────
  
    createdAt: Date
    updatedAt: Date
  
    // ── Instance methods ────────────────────────────────────────────────
  
    /*
     * verifyPassword — compares a plaintext password against passwordHash.
     * Returns true if the password matches, false otherwise.
     *
     * Usage (in auth route A-03):
     *   const admin = await Admin.findOne({ email })
     *   const isValid = await admin.verifyPassword(plaintext)
     */
    verifyPassword(plaintext: string): Promise<boolean>
  }
  
  /*
   * IAdminModel — extends Model<IAdmin> to include static methods.
   * Required for TypeScript to recognise Admin.hashPassword() as a
   * valid static method on the model.
   */
  export interface IAdminModel extends Model<IAdmin> {
    /*
     * hashPassword — hashes a plaintext password using bcryptjs.
     * Static method — called on the Model, not an instance.
     *
     * Usage (in seed script DB-10):
     *   const hash = await Admin.hashPassword('securepassword')
     *   await Admin.create({ email, passwordHash: hash, name, role })
     *
     * Usage (in admin creation route):
     *   const passwordHash = await Admin.hashPassword(body.password)
     */
    hashPassword(plaintext: string): Promise<string>
  }
  
  /*
   * IAdminInput — plain object type for creating an Admin document.
   * Accepts plaintext password (not hash) — the route handler or
   * seed script calls Admin.hashPassword() before passing to create().
   *
   * Omits Document fields and passwordHash (handled by the caller).
   * Omits lastLoginAt (set to null by default).
   */
  export interface IAdminInput {
    email: string
    password: string      // Plaintext — hashed before storage
    name: string
    role?: AdminRole
    isActive?: boolean
  }
  
  /*
   * IAdminSession — the minimal shape stored in the iron-session cookie.
   * Passed to the session after successful login (A-03).
   * Contains only non-sensitive identifiers — never passwordHash.
   */
  export interface IAdminSession {
    id: string            // admin._id.toString()
    email: string
    name: string
    role: AdminRole
  }
  
  // ---------------------------------------------------------------------------
  // Schema
  // ---------------------------------------------------------------------------
  
  const AdminSchema = new Schema<IAdmin, IAdminModel>(
    {
      // ── Identity ────────────────────────────────────────────────────
  
      email: {
        type: String,
        required: [true, 'Admin email is required'],
        trim: true,
        /*
         * lowercase: true — normalise email to lowercase before saving.
         * Prevents "admin@example.com" and "Admin@Example.com" being
         * treated as different accounts.
         */
        lowercase: true,
        unique: true,
        match: [
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          'Please provide a valid email address',
        ],
        maxlength: [254, 'Email must be 254 characters or fewer'],
      },
  
      passwordHash: {
        type: String,
        required: [true, 'Password hash is required'],
        /*
         * minlength: 60 — bcryptjs hashes are always 60 characters.
         * Format: $2a$12$[22-char salt][31-char hash]
         * This validates that a bcrypt hash (not plaintext) was stored.
         */
        minlength: [60, 'Password hash appears to be invalid'],
        /*
         * select: false — passwordHash is EXCLUDED from all query results
         * by default. Must be explicitly selected with:
         *   Admin.findOne({ email }).select('+passwordHash')
         * This prevents accidental exposure in API responses even if
         * the toJSON transform is bypassed.
         */
        select: false,
      },
  
      name: {
        type: String,
        required: [true, 'Admin name is required'],
        trim: true,
        maxlength: [100, 'Name must be 100 characters or fewer'],
      },
  
      role: {
        type: String,
        required: true,
        enum: {
          values: ADMIN_ROLES as unknown as string[],
          message: 'Role must be one of: superadmin, editor',
        },
        default: 'superadmin' satisfies AdminRole,
      },
  
      lastLoginAt: {
        type: Date,
        default: null,
      },
  
      isActive: {
        type: Boolean,
        default: true,
      },
    },
    {
      timestamps: true,
      collection: 'admins',
  
      /*
       * toJSON transform — strips passwordHash from all JSON output.
       *
       * Even with select:false, explicitly removing passwordHash in toJSON
       * provides defence-in-depth. If a future query accidentally uses
       * .select('+passwordHash'), the toJSON transform still prevents
       * it from reaching the client.
       */
      toJSON: {
        virtuals: true,
        transform: function (
          _doc: IAdmin,
          ret: Record<string, unknown>,
        ): Record<string, unknown> {
          delete ret['passwordHash']
          delete ret['__v']
          return ret
        },
      },
      toObject: {
        virtuals: true,
        transform: function (
          _doc: IAdmin,
          ret: Record<string, unknown>,
        ): Record<string, unknown> {
          delete ret['passwordHash']
          delete ret['__v']
          return ret
        },
      },
    },
  )
  
  // ---------------------------------------------------------------------------
  // Indexes
  // ---------------------------------------------------------------------------
  
  /*
   * email: unique — enforced at schema level (unique: true above).
   * Mongoose creates this index automatically.
   *
   * Additional indexes for admin panel query patterns:
   */
  
  /*
   * role + isActive compound index — admin management queries:
   *   Admin.find({ role: 'editor', isActive: true })
   * Covers filtering by role and activity status simultaneously.
   */
  AdminSchema.index({ role: 1, isActive: 1 })
  
  /*
   * lastLoginAt descending — security audit queries:
   *   Admin.find().sort({ lastLoginAt: -1 })
   * Shows most recently active admins first.
   */
  AdminSchema.index({ lastLoginAt: -1 })
  
  // ---------------------------------------------------------------------------
  // Instance methods
  // ---------------------------------------------------------------------------
  
  /*
   * verifyPassword — compares plaintext against the stored passwordHash.
   *
   * IMPORTANT: This method requires passwordHash to be present on the document.
   * When querying an admin for authentication, explicitly select passwordHash:
   *   const admin = await Admin.findOne({ email }).select('+passwordHash')
   *
   * bcryptjs.compare is timing-safe — it always takes the same amount of
   * time regardless of whether the password matches or not. This prevents
   * timing attacks that could reveal password hash prefixes.
   */
  AdminSchema.methods.verifyPassword = async function (
    plaintext: string,
  ): Promise<boolean> {
    /*
     * Guard: if passwordHash is not loaded (missing select('+passwordHash')),
     * throw a clear error rather than returning false silently.
     * A silent false would make every login attempt fail without explanation.
     */
    if (!this.passwordHash) {
      throw new Error(
        '[Admin.verifyPassword] passwordHash is not loaded. ' +
          'Query with .select(\'+passwordHash\') before calling verifyPassword.',
      )
    }
  
    return bcryptjs.compare(plaintext, this.passwordHash as string)
  }
  
  // ---------------------------------------------------------------------------
  // Static methods
  // ---------------------------------------------------------------------------
  
  /*
   * hashPassword — hashes a plaintext password using bcryptjs.
   *
   * Validates that the plaintext meets minimum requirements before hashing.
   * Minimum 8 characters — weak passwords are rejected at the model layer
   * regardless of what the API route validates.
   *
   * Cost: BCRYPT_COST (12) — takes ~250ms on modern hardware.
   */
  AdminSchema.statics.hashPassword = async function (
    plaintext: string,
  ): Promise<string> {
    if (!plaintext || plaintext.length < 8) {
      throw new Error(
        '[Admin.hashPassword] Password must be at least 8 characters.',
      )
    }
  
    const salt = await bcryptjs.genSalt(BCRYPT_COST)
    return bcryptjs.hash(plaintext, salt)
  }
  
  // ---------------------------------------------------------------------------
  // Pre-save middleware
  // ---------------------------------------------------------------------------
  
  /*
   * Pre-save hook: normalise email to lowercase.
   * The schema has lowercase: true which handles inserts,
   * but updates via .save() may bypass schema-level transforms.
   * This hook ensures email is always lowercase regardless of how
   * the document is modified.
   */
  AdminSchema.pre('save', function (next) {
    if (this.isModified('email') && typeof this.email === 'string') {
      this.email = this.email.toLowerCase().trim()
    }
    next()
  })
  
  // ---------------------------------------------------------------------------
  // Standalone utility export
  // ---------------------------------------------------------------------------
  
  /*
   * hashPassword — standalone export for use outside Mongoose context.
   *
   * Allows the seed script (DB-10) and tests to hash passwords without
   * needing to import the full Admin model.
   *
   * Usage:
   *   import { hashPassword } from '@/lib/db/models/Admin'
   *   const hash = await hashPassword('securepassword')
   */
  export async function hashPassword(plaintext: string): Promise<string> {
    if (!plaintext || plaintext.length < 8) {
      throw new Error('Password must be at least 8 characters.')
    }
    const salt = await bcryptjs.genSalt(BCRYPT_COST)
    return bcryptjs.hash(plaintext, salt)
  }
  
  // ---------------------------------------------------------------------------
  // Model export — singleton pattern
  // ---------------------------------------------------------------------------
  
  /*
   * Singleton model registration.
   * Uses IAdminModel (not Model<IAdmin>) to include the hashPassword static.
   */
  const Admin =
    (mongoose.models['Admin'] as IAdminModel | undefined) ??
    mongoose.model<IAdmin, IAdminModel>('Admin', AdminSchema)
  
  export default Admin