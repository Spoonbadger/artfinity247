import * as z from "zod";

// Subscribe Form with 'zod'
export const subscribeFormSchema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
});
export type TSubscribeFormSchema = z.infer<typeof contactFormSchema>;

// Contact Form with 'zod'
export const contactFormSchema = z.object({
  first_name: z
    .string()
    .min(2, {
      message: "First name must be at least 2 characters",
    })
    .max(50),
  last_name: z.string().optional(),
  email: z.string().email({ message: "Enter a valid email" }),
  message: z.string().min(10, {
    message: "Message must be at least 10 characters",
  }),
});
export type TContactFormSchema = z.infer<typeof contactFormSchema>;

// Register Form with 'zod'
export const registerFormSchema = z
  .object({
    first_name: z
      .string()
      .min(2, {
        message: "First name must be at least 2 characters",
      })
      .max(50),
    last_name: z.string().optional(),
    artist_name: z
      .string()
      .min(2, {
        message: "Artist name must be at least 2 characters",
      })
      .max(50),
    email: z.string().email({ message: "Enter a valid email" }),
    password: z
      .string()
      .min(6, {
        message:
          "Your password must be 6-20 characters long, contain letters and numbers, can include special characters, and must not contain spaces or emoji.",
      })
      .max(20, {
        message:
          "Your password must be 6-20 characters long, contain letters and numbers, can include special characters, and must not contain spaces or emoji.",
      })
      .regex(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
        message:
          "Your password must be 6-20 characters long, contain letters and numbers, can include special characters, and must not contain spaces or emoji.",
      }),
    confirm_password: z.string().min(6).max(20),
    avatar: z.string().optional(),
    phone: z.string().optional(),
    city: z.string(),
    state: z.string().optional(),
    country: z.string().optional(),
    tc_accept: z.boolean(),
  })
  .superRefine(({ confirm_password, password }, ctx) => {
    if (confirm_password !== password) {
      ctx.addIssue({
        code: "custom",
        message: "The passwords did not match",
      });
    }
  });
export type TRegisterFormSchema = z.infer<typeof registerFormSchema>

// Login Form with 'zod'
export const loginFormSchema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
  password: z.string().min(6, {
    message: "Incorrect password",
  }),
  remember: z.boolean().optional(),
});
export type TLoginFormSchema = z.infer<typeof loginFormSchema>;

// Forgot Password Form with 'zod'
export const forgotPasswordFormSchema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
});
export type TForgotPasswordFormSchema = z.infer<
  typeof forgotPasswordFormSchema
>;

// Change Password Form with 'zod'
export const changePasswordFormSchema = z.object({
  old_password: z
    .string()
    .min(6, {
      message: "Incorrect old-password",
    })
    .max(20, {
      message: "Incorrect old-password",
    }),
  new_password: z
    .string()
    .min(6, {
      message:
        "Your new-password must be 6-20 characters long, contain letters and numbers, can include special characters, and must not contain spaces or emoji.",
    })
    .max(20, {
      message:
        "Your new-password must be 6-20 characters long, contain letters and numbers, can include special characters, and must not contain spaces or emoji.",
    })
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
      message:
        "Your new-password must be 6-20 characters long, contain letters and numbers, can include special characters, and must not contain spaces or emoji.",
    }),
});
export type TChangePasswordFormSchema = z.infer<
  typeof changePasswordFormSchema
>;
