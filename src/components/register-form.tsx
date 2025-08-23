"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from '@/lib/auth';
import { registerSchema } from '@/lib/validations';

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      email_id: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await signUp({
        full_name: data.full_name,
        email_id: data.email_id,
        password: data.password
      });
      
      // Check if email confirmation is required
      if (result?.user && !result.user.email_confirmed_at) {
        setRegistrationSuccess(true);
      } else {
        // If email confirmation is not required or already confirmed
        router.push('/admin');
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // Show confirmation message if registration is successful
  if (registrationSuccess) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle>Confirm Your Email</CardTitle>
            <CardDescription>
              We've sent a confirmation email to your inbox
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 mb-3">
                We've sent a confirmation email to your inbox.
              </p>
              <p className="text-blue-700">
                Please check your email and click the confirmation link to complete your registration.
              </p>
              <p className="text-blue-700 mt-3">
                After confirmation, you will be redirected to the admin page.
              </p>
            </div>
            <div className="mt-6 text-center">
              <Link href="/login" className="text-blue-600 hover:text-blue-500 underline underline-offset-4">
                Return to login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Create an Account</CardTitle>
          <CardDescription>
            Enter your information to create an account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="full_name">Full Name*</Label>
                <Input
                  id="full_name"
                  placeholder="John Doe"
                  autoComplete="name"
                  disabled={isLoading}
                  {...register('full_name')}
                />
                {errors?.full_name && (
                  <p className="text-sm text-red-500">{errors.full_name.message}</p>
                )}
              </div>
              
              <div className="grid gap-3">
                <Label htmlFor="email_id">Email*</Label>
                <Input
                  id="email_id"
                  type="email"
                  placeholder="name@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading}
                  {...register('email_id')}
                />
                {errors?.email_id && (
                  <p className="text-sm text-red-500">{errors.email_id.message}</p>
                )}
              </div>
              
              <div className="grid gap-3">
                <Label htmlFor="password">Password*</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isLoading}
                  {...register('password')}
                />
                {errors?.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>
              
              <div className="grid gap-3">
                <Label htmlFor="confirmPassword">Confirm Password*</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isLoading}
                  {...register('confirmPassword')}
                />
                {errors?.confirmPassword && (
                  <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
                )}
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create Account'}
              </Button>
            </div>
            
            <div className="mt-4 text-center text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-500 underline underline-offset-4">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
