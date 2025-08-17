"use client";

import { ReactNode, useState, useEffect } from "react";
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
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CityType,
  CountryType,
  registerFormSchema,
  StateType,
  TRegisterFormSchema,
} from "@/types";
import { getCities, getCountries, getStates } from "@/db/query";
import { getAppPages } from "@/db/query";
import { useRouter } from 'next/navigation'


const AppPages = getAppPages();

const RegisterForm = ({
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
  const form = useForm<TRegisterFormSchema>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      artist_name: "",
      email: "",
      password: "",
      confirm_password: "",
      avatar: "",
      phone: "",
      city: "",
      state: "",
      country: "",
    },
  });

  const { slug: loginPageSlug } = AppPages.login;
  const { slug: tacPageSlug } = AppPages.terms_and_conditions;

  const [countries, setCountries] = useState<CountryType[]>([]);
  const [states, setStates] = useState<StateType[]>([]);
  const [cities, setCities] = useState<CityType[]>([]);

  const [availCountries, setAvailCountries] = useState<CountryType[]>([]);
  const [availStates, setAvailStates] = useState<StateType[]>([]);
  const [availCities, setAvailCities] = useState<CityType[]>([]);

  const router = useRouter()

  useEffect(() => {
    setCountries(getCountries());
    setStates(getStates());
    setCities(getCities());
  }, [])

  useEffect(() => {
    setAvailCountries([...countries].sort((a, b) => a.name.localeCompare(b.name)))
  }, [countries])

  const handleCountryChange = (country_code: string) => {
    setAvailStates((prev) =>
      states
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((state) => state.country_code === country_code),
    );
    setAvailCities([]);
  };

  const handleStateChange = (state_code: string) => {
    setAvailCities((prev) =>
      cities
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((city) => city.state_code === state_code),
    );
  };

  const handleSubmit: SubmitHandler<TRegisterFormSchema> = async (values) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          name: values.artist_name,
          email: values.email,
          password: values.password,
          phone: values.phone,
          city: values.city,
          state: values.state,
          country: values.country,
          profileImage: values.avatar || null,
        })
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        toast.error(`Registration failed: ${errorText}`)
        return
      }
      
      const data = await res.json()
      console.log("Register data response: ", data)
      toast.success("Registration successfull")
      
      const slug = data?.artist?.slug
      window.location.assign(`/artists/${slug}`)
      form.reset()

    } catch (err) {
      console.log('Error with RegisterForm: ', err)
    }
  }

  return (
    <div
      className={cn(
        "register-form-area text-center",
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
            className="register-form mx-auto grid w-full grid-cols-1 items-center gap-2 text-start md:gap-4"
          >
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              {/* First Name Field */}
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter First Name"
                        className="form-input rounded-sm"
                      />
                    </FormControl>
                    <FormDescription>Your first name</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Last Name Field */}
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter Last Name"
                        className="form-input rounded-sm"
                      />
                    </FormControl>
                    <FormDescription>Your last name</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {/* Artist Name Field */}
            <FormField
              control={form.control}
              name="artist_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Artist Name</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      {...field}
                      placeholder="Enter Artist Name"
                      className="form-input rounded-sm"
                    />
                  </FormControl>
                  <FormDescription>Your artist name (public)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      placeholder="Enter Email"
                      className="form-input rounded-sm"
                    />
                  </FormControl>
                  <FormDescription>Your email address</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              {/* Password Field */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter Password"
                        className="form-input rounded-sm"
                        title="Your password must be 6-20 characters long, contain letters and numbers,
                        can include special characters, and must not contain spaces or emoji."
                      />
                    </FormControl>
                    <FormDescription>Your new password</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Confirm Password Field */}
              <FormField
                control={form.control}
                name="confirm_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter Password Again"
                        className="form-input rounded-sm"
                      />
                    </FormControl>
                    <FormDescription>Confirm your password</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div
              className={cn(
                "grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4",
                "[&>*]:md:col-span-1 [&>:first-child]:col-span-3 [&>:first-child]:md:col-span-1",
              )}
            >
              {/* Country Field */}
              <FormField
                name="country"
                control={form.control}
                render={({ field }) => {
                  return (
                    <FormItem className="[&_button]:rounded-sm [&_button]:capitalize">
                      <FormLabel>Country</FormLabel>
                      <Select
                        onValueChange={(newVal) => {
                          field.onChange(newVal);
                          handleCountryChange(newVal);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="--Select Your Country--" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="w-full rounded-sm capitalize">
                          <SelectGroup>
                            <SelectLabel>Your Country</SelectLabel>
                            {availCountries.map((country, index) => (
                              <SelectItem value={country.code} key={index}>
                                {country.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              {/* State Field */}
              <FormField
                name="state"
                control={form.control}
                render={({ field }) => {
                  return (
                    <FormItem className="[&_button]:rounded-sm [&_button]:capitalize">
                      <FormLabel>State</FormLabel>
                      <Select
                        onValueChange={(newVal) => {
                          field.onChange(newVal);
                          handleStateChange(newVal);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="--Select Your State--" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="w-full rounded-sm capitalize">
                          <SelectGroup>
                            <SelectLabel>Your State</SelectLabel>
                            {availStates.map((state, index) => (
                              <SelectItem value={state.code} key={index}>
                                {state.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              {/* City Field */}
              <FormField
                name="city"
                control={form.control}
                render={({ field }) => {
                  return (
                    <FormItem className="[&_button]:rounded-sm [&_button]:capitalize">
                      <FormLabel>City</FormLabel>
                      <Select onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="--Select Your City--" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="w-full rounded-sm capitalize">
                          <SelectGroup>
                            <SelectLabel>Your City</SelectLabel>
                            {availCities.map((city, index) => (
                              <SelectItem value={city.code} key={index}>
                                {city.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
            {/* Phone Number Field */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      {...field}
                      placeholder="Enter Phone Number"
                      className="form-input rounded-sm"
                    />
                  </FormControl>
                  <FormDescription>Your phone Number</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Accept Terms and Conditions Field */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 leading-none">
                <Checkbox id="remember" name="remember" />
                <label
                  htmlFor="remember"
                  className="select-none text-sm font-medium capitalize leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Agree to{" "}
                  <Link
                    href={`/${tacPageSlug || "terms-and-conditions"}`}
                    target="_blank"
                  >
                    Terms And Conditions
                  </Link>
                </label>
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
              Register
            </Button>
            {/* Additional Links */}
            <div className="mt-2 grid w-full text-center">
              <Link href={`/${loginPageSlug || "login"}`}>
                Already have an account?
              </Link>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default RegisterForm;
