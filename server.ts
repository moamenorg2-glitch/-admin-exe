import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

// --- Error Handling Utilities ---
class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Global Error Handler:", err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err)) || 'Internal Server Error';
  
  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message
  });
};
// --------------------------------

const upload = multer({ storage: multer.memoryStorage() });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to format phone to E.164 (assuming Egypt +20)
function formatPhone(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "20" + cleaned.substring(1);
  }
  return cleaned.startsWith("+") ? cleaned : "+" + cleaned;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Supabase Admin Client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dvuygxgpeofzegzjqjie.supabase.co';
  const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    console.warn("⚠️ WARNING: Supabase Service Role Key is missing on the server.");
  }

  const supabaseAdmin = supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
    : null;

  // API Routes
  app.post("/api/admin/create-user", catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (!supabaseAdmin) {
      return next(new AppError("Supabase Service Role Key is not configured", 500));
    }

    const { email, phone, password, full_name, user_type, metadata } = req.body;
    const formattedPhone = phone ? formatPhone(phone) : undefined;

    // 1. Create Auth User
    let { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email || undefined,
      phone: formattedPhone,
      password: password,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { full_name, user_type }
    });

    if (authError) {
      // Handle Conflict: If user already exists, try to archive them if they are inactive or belong to a deleted profile
      if (authError.message.includes("already been registered")) {
        console.log("User already exists, attempting recovery/cleanup...");
        // This is a bit advanced, but let's try to find the profile and see if it's ' محذوف'
        const { data: conflictProfiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id, status")
          .or(`email.eq.${email},primary_phone.eq.${formattedPhone}`);

        if (conflictProfiles && conflictProfiles.length > 0) {
          for (const p of conflictProfiles) {
            const timestamp = Date.now();
            const cleanupEmail = `archived.${timestamp}@cleanup.com`;
            // Free up the credentials
            await supabaseAdmin.auth.admin.updateUserById(p.user_id, {
               email: cleanupEmail,
               phone: `999${timestamp}`.substring(0, 15)
            }).catch(() => null);
            
            await supabaseAdmin.from("profiles").update({
              email: cleanupEmail,
              primary_phone: `999${timestamp}`.substring(0, 15),
              status: 'محذوف'
            }).eq("user_id", p.user_id);
          }
          
          // Retry creation
          const retry = await supabaseAdmin.auth.admin.createUser({
            email: email || undefined,
            phone: formattedPhone,
            password: password,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: { full_name, user_type }
          });
          authData = retry.data;
          authError = retry.error;
        }
      }
      
      if (authError) throw new AppError(authError.message, 400);
    }

    const userId = authData.user.id;

    // 2. Create Profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: userId,
        full_name,
        user_type,
        primary_phone: formattedPhone || "",
        email: email || null,
        status: 'نشط',
        avatar_url: req.body.avatar_url || null
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new AppError(profileError.message, 400);
    }

    // 3. Create specific details (driver/vendor/customer)
    if (user_type === 'driver' && metadata.driver_details) {
      const { error: driverError } = await supabaseAdmin
        .from("driver_details")
        .insert({
          user_id: userId,
          ...metadata.driver_details
        });
      if (driverError) throw new AppError(driverError.message, 400);
    } else if (user_type === 'vendor' && metadata.vendor_details) {
      const { tax_registration_number, ...vendorDetails } = metadata.vendor_details;
      const { error: vendorError } = await supabaseAdmin
        .from("vendor_details")
        .insert({
          user_id: userId,
          tax_registration_number,
          ...vendorDetails
        });
      if (vendorError) throw new AppError(vendorError.message, 400);
    } else if (user_type === 'customer' && metadata.customer_details) {
      const { error: customerError } = await supabaseAdmin
        .from("customer_details")
        .insert({
          user_id: userId,
          ...metadata.customer_details
        });
      if (customerError) throw new AppError(customerError.message, 400);
    }

    // 4. Create Wallet
    await supabaseAdmin.from("wallets").insert({ user_id: userId });

    res.json({ user_id: userId });
  }));

  app.post("/api/admin/update-user", catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (!supabaseAdmin) {
      return next(new AppError("Supabase Service Role Key is not configured", 500));
    }

    const { userId, email, phone, password, full_name, user_type, metadata } = req.body;
    const formattedPhone = phone ? formatPhone(phone) : undefined;

    // 1. Update Auth User
    const updateData: any = {};
    if (email) updateData.email = email;
    if (formattedPhone) updateData.phone = formattedPhone;
    if (password) updateData.password = password;
    
    const userMetadata: any = {};
    if (full_name) userMetadata.full_name = full_name;
    if (user_type) userMetadata.user_type = user_type;
    
    if (Object.keys(userMetadata).length > 0) {
      updateData.user_metadata = userMetadata;
    }

    if (Object.keys(updateData).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
      if (authError) throw new AppError(authError.message, 400);
    }

    // 2. Update Profile
    const updateProfileData: any = {
        full_name,
        primary_phone: formattedPhone || "",
        email: email || null,
    };
    if (req.body.avatar_url !== undefined) {
        updateProfileData.avatar_url = req.body.avatar_url;
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(updateProfileData)
      .eq('user_id', userId);

    if (profileError) throw new AppError(profileError.message, 400);

    // 3. Update specific details
    if (user_type === 'driver' && metadata?.driver_details) {
      const { error: driverError } = await supabaseAdmin
        .from("driver_details")
        .update(metadata.driver_details)
        .eq('user_id', userId);
      if (driverError) throw new AppError(driverError.message, 400);
    } else if (user_type === 'vendor' && metadata?.vendor_details) {
      const { tax_registration_number, ...vendorDetails } = metadata.vendor_details;
      const { error: vendorError } = await supabaseAdmin
        .from("vendor_details")
        .update({
          tax_registration_number,
          ...vendorDetails
        })
        .eq('user_id', userId);
      if (vendorError) throw new AppError(vendorError.message, 400);
    } else if (user_type === 'customer' && metadata?.customer_details) {
      const { error: customerError } = await supabaseAdmin
        .from("customer_details")
        .update(metadata.customer_details)
        .eq('user_id', userId);
      if (customerError) throw new AppError(customerError.message, 400);
    }

    res.json({ success: true });
  }));

  app.post("/api/admin/delete-user", catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (!supabaseAdmin) {
      return next(new AppError("Supabase Service Role Key is not configured", 500));
    }

    const { userId } = req.body;
    if (!userId) {
      return next(new AppError("User ID is required", 400));
    }

    // Delete from Auth (this will cascade to profiles and other tables if foreign keys are set to CASCADE)
    // However, it's safer to delete from Auth using admin API.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authError) {
      // If user doesn't exist in Auth, we might still want to try deleting from profiles
      if (authError.message.includes('User not found')) {
        const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('user_id', userId);
        if (profileError) throw new AppError(profileError.message, 400);
      } else {
        throw new AppError(authError.message, 400);
      }
    }

    res.json({ success: true });
  }));

  // Image Management Routes
  app.post("/api/admin/upload", (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({ status: 'error', message: err.message });
      }
      next();
    });
  }, catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    console.log("Upload route hit");
    if (!supabaseAdmin) return next(new AppError("Supabase Service Role Key is not configured", 500));
    if (!req.file) {
      console.log("No file uploaded");
      return next(new AppError("No file uploaded", 400));
    }

    const { bucket, path: filePath } = req.body;
    console.log("Upload request body:", req.body);
    const { data, error } = await supabaseAdmin.storage.from(bucket).upload(filePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true
    });
    if (error) throw new AppError(error.message, 400);

    const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(data.path);
    
    res.json({ ...data, publicUrl: publicUrlData.publicUrl });
  }));

  app.post("/api/admin/delete", catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (!supabaseAdmin) return next(new AppError("Supabase Service Role Key is not configured", 500));
    const { bucket, paths } = req.body;
    const { data, error } = await supabaseAdmin.storage.from(bucket).remove(paths);
    if (error) throw new AppError(error.message, 400);
    res.json(data);
  }));

  app.post("/api/admin/update", (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({ status: 'error', message: err.message });
      }
      next();
    });
  }, catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (!supabaseAdmin) return next(new AppError("Supabase Service Role Key is not configured", 500));
    if (!req.file) return next(new AppError("No file uploaded", 400));
    const { bucket, path: filePath } = req.body;
    const { data, error } = await supabaseAdmin.storage.from(bucket).update(filePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true
    });
    if (error) throw new AppError(error.message, 400);

    const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(data.path);
    
    res.json({ ...data, publicUrl: publicUrlData.publicUrl });
  }));

  // 404 for API routes - Ensure JSON response
  app.all("/api/*", (req, res) => {
    console.warn(`[404] API Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
      status: 'error',
      message: `المسار المطلوب غير موجود: ${req.method} ${req.originalUrl}`
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting development server with Vite middleware...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (vError) {
      console.error("Vite server creation failed:", vError);
    }
  } else {
    console.log("Starting production server...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Register Global Error Handler (Must be LAST)
  app.use(globalErrorHandler);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
