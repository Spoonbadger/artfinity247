"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { loginFormSchema, TLoginFormSchema } from "@/types";
import { getAppPages } from "@/db/query";
import { useRouter } from 'next/navigation'
import { useUser } from '@/components/contexts/UserProvider'


const AppPages = getAppPages()

const LoginForm = ({
  title,
  subTitle,
  description,
  showFormInfo = true,
  className,
}: {
  title?: string;
  subTitle?: string;
  description?: string;
  showFormInfo?: boolean;
  className?: string;
}): ReactNode => {
  const form = useForm<TLoginFormSchema>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { slug: registerPageSlug } = AppPages.register;
  const { slug: recoverPageSlug } = AppPages.recover_password;

  const [showPassword, setShowPassword] = useState(false)

  const router = useRouter()
  const { setCurrentUser } = useUser()

  const handleSubmit: SubmitHandler<TLoginFormSchema> = async (values) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        remember: values.remember ?? false,
      }),
    });

    let data: any = null;
    try { data = await res.json(); } catch {}

    if (!res.ok) {
      const code = data?.code;
      toast.error(
        code === 'user_not_found' ? 'No account with that email.' :
        code === 'bad_password'  ? 'Incorrect password.' :
        code === 'missing_fields'? 'Please enter email and password.' :
        'Login failed.'
      );
      console.error('LOGIN_FAIL', code, data);
      return;
    }

    toast.success('Login successful')
    const { artist, token } = data

    
    if (values.remember) {
      localStorage.setItem('token', token)
      sessionStorage.removeItem('token')
    } else {
      sessionStorage.setItem('token', token)
      localStorage.removeItem('token')
    }

    setCurrentUser({
      id: artist.id,
      slug: artist.slug,
      email: artist.email,
      name: artist.name
    } as any)

    setTimeout(() => {
      form.reset()
      router.push(`/artists/${artist.slug}`)
    }, 20)
  }

  return (
    <div
      className={cn(
        "login-form-area text-center",
        "[&_a]:opacity-85 hover:[&_a]:underline hover:[&_a]:opacity-100",
        className,
      )}
    >
      {showFormInfo && (
        <div className="form-header mb-4 space-y-1 md:mb-6">
          {subTitle && (
            <h5 className="area-sub-title form-sub-title capitalize text-slate-800 opacity-75 dark:text-slate-200">
              {subTitle}
            </h5>
          )}
          {title && (
            <h2 className="area-title form-title capitalize">{title}</h2>
          )}
          {description && (
            <p className="area-text form-description text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="form-content">
        <Form {...form}>
          <form
            method="POST"
            onSubmit={form.handleSubmit(handleSubmit)}
            className="login-form mx-auto grid w-full grid-cols-1 items-center gap-2 text-start md:gap-4"
          >
            {/* Email Field */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="Enter Your Email"
                      className="form-input rounded-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Password Field */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter Your Password"
                        className="form-input rounded-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-3 my-auto text-[10px] text-muted-foreground"
                      >   
                        {showPassword ? "hide" : "show"}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Remember Login Field & Additional Links */}
            <div className="flex items-center justify-between">
              <FormField
                control={form.control}
                name="remember"
                render={({ field }) => (
                  <div className="flex items-center gap-2 leading-none">
                    <Checkbox
                      id="remember"
                      checked={!!field.value}
                      onCheckedChange={(v) => field.onChange(Boolean(v))}
                    />
                    <label htmlFor="remember" className="select-none text-sm font-medium capitalize leading-none">
                      Remember me
                    </label>
                  </div>
                )}
              />
              <div>
                <Link href={`/${recoverPageSlug || "recover-password"}`}>Forgot your password?</Link>
              </div>
            </div>

            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="form-btn action-btn mx-auto mt-4 w-full rounded-sm px-4 py-5 uppercase"
            >
              {form.formState.isSubmitting && (
                <Loader2 className="mr-2 size-4 animate-spin !text-background" />
              )}
              Login
            </Button>
            {/* Additional Links */}
            <div className="mt-2 grid w-full text-center">
              <Link href={`/${registerPageSlug || "register"}`}>
                Create Account
              </Link>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default LoginForm
