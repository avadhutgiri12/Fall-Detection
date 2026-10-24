"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input, Textarea } from "./ui/Input";
import { SectionWrapper, SectionHeader } from "./ui/Section";
import { contactContent, uiContent } from "../data/content";

gsap.registerPlugin(ScrollTrigger);

interface FormData {
  name: string;
  email: string;
  phone: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

export function Contact() {
  const sectionRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    const ctx = gsap.context(() => {
      const section = sectionRef.current;
      if (!section) return;

      // Animate section header
      const header = section.querySelector(".section-header");
      if (header) {
        gsap.fromTo(header,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "expo.out",
            scrollTrigger: {
              trigger: section,
              start: "top 80%",
              toggleActions: "play none none reverse",
            }
          }
        );
      }

      // Animate contact info cards
      const infoCards = section.querySelectorAll(".contact-info-card");
      if (infoCards.length > 0) {
        gsap.fromTo(infoCards,
          { x: -60, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.6,
            ease: "expo.out",
            stagger: 0.1,
            scrollTrigger: {
              trigger: section,
              start: "top 75%",
              toggleActions: "play none none reverse",
            }
          }
        );
      }

      // Animate form
      const form = section.querySelector(".contact-form");
      if (form) {
        gsap.fromTo(form,
          { x: 60, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.6,
            ease: "expo.out",
            delay: 0.2,
            scrollTrigger: {
              trigger: section,
              start: "top 75%",
              toggleActions: "play none none reverse",
            }
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = uiContent.form.required;
    }

    if (!formData.email.trim()) {
      newErrors.email = uiContent.form.required;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = uiContent.form.invalidEmail;
    }

    if (formData.phone.trim() && !/^[\d\s\-\+\(\)]{10,}$/.test(formData.phone)) {
      newErrors.phone = uiContent.form.invalidPhone;
    }

    if (!formData.message.trim()) {
      newErrors.message = uiContent.form.required;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitStatus("idle");

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In a real app, you would submit to an API here
    // const response = await fetch('/api/contact', { method: 'POST', body: JSON.stringify(formData) });

    setIsSubmitting(false);
    setSubmitStatus("success");
    setFormData({ name: "", email: "", phone: "", message: "" });
    formRef.current?.reset();

    // Reset success status after 5 seconds
    setTimeout(() => setSubmitStatus("idle"), 5000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <SectionWrapper
      ref={sectionRef}
      id="contact"
      variant="alternate"
      size="lg"
      className="relative"
    >
      <div className="relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <SectionHeader
            className="section-header"
            title={contactContent.title}
            subtitle={contactContent.subtitle}
            align="center"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Contact Info */}
          <div className="space-y-6">
            {contactContent.contactInfo.map((item, index) => (
              <Card
                key={item.label}
                className="contact-info-card p-6"
                padding="none"
                hover
              >
                <CardContent className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0" aria-hidden="true">
                    {item.icon === "mail" && (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    )}
                    {item.icon === "phone" && (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    )}
                    {item.icon === "map-pin" && (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    )}
                    {item.icon === "clock" && (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">{item.label}</h4>
                    {item.link ? (
                      <a href={item.link} className="text-muted-foreground hover:text-primary transition-colors mt-1 block">
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-muted-foreground mt-1">{item.value}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Contact Form */}
          <div className="contact-form">
            <Card padding="none" className="p-8">
              <CardHeader className="mb-6">
                <CardTitle>Send us a Message</CardTitle>
                <CardDescription>
                  We'll get back to you within 24 hours.
                </CardDescription>
              </CardHeader>

              <form ref={formRef} onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="grid sm:grid-cols-2 gap-5">
                  <Input
                    label="Full Name"
                    name="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleChange}
                    error={errors.name}
                    required
                    autoComplete="name"
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    name="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    error={errors.email}
                    required
                    autoComplete="email"
                  />
                </div>

                <Input
                  label="Phone Number (Optional)"
                  type="tel"
                  name="phone"
                  placeholder="+1 (555) 000-0000"
                  value={formData.phone}
                  onChange={handleChange}
                  error={errors.phone}
                  autoComplete="tel"
                />

                <Textarea
                  label="Message"
                  name="message"
                  placeholder="Tell us about your needs..."
                  value={formData.message}
                  onChange={handleChange}
                  error={errors.message}
                  required
                  rows={5}
                />

                {submitStatus === "success" && (
                  <div className="p-4 bg-success/10 border border-success/20 rounded-lg text-success" role="alert">
                    <p className="font-medium">{contactContent.form.successMessage}</p>
                  </div>
                )}

                {submitStatus === "error" && (
                  <div className="p-4 bg-error/10 border border-error/20 rounded-lg text-error" role="alert">
                    <p className="font-medium">{contactContent.form.errorMessage}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? uiContent.button.loading : contactContent.form.submitButton}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}