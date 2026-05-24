import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'worker';
  created_at: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must not exceed 100 characters'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      maxlength: [254, 'Email must not exceed 254 characters'],
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v: string) {
          // Standard email format: local-part@domain with valid domain
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Email must be a valid email address',
      },
    },
    password_hash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'worker'],
        message: 'Role must be either admin or worker',
      },
      default: 'worker',
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Case-insensitive unique index on email
UserSchema.index({ email: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

// Pre-save hook: hash password if it's being set via a virtual or direct assignment
UserSchema.pre('save', async function (next) {
  // Only hash if password_hash looks like a plaintext password (not already hashed)
  // bcrypt hashes start with $2a$ or $2b$
  if (this.isModified('password_hash') && !this.password_hash.startsWith('$2')) {
    const salt = await bcrypt.genSalt(12);
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
  }
  next();
});

// Instance method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password_hash);
};

export const User = mongoose.model<IUser>('User', UserSchema);
