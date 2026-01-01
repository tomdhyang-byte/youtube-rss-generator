"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "@/routing";
import { useEffect, useState } from "react";
import { Loader2, Play, Rss, Monitor, LogIn, PlusCircle, FileText, Link, Mail, RefreshCw, Radio } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

export default function LandingPage() {
  const { status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations('Home');
  const tCommon = useTranslations('Common');
  const locale = useLocale();

  // Redirect authenticated users to feed
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/feed");
    }
  }, [status, router]);

  const handleTryIt = async () => {
    setIsLoading(true);
    await signIn("google", { callbackUrl: `/${locale}/feed` });
  };

  // Show loading while checking session or redirecting
  if (status === "loading" || status === "authenticated") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="min-h-screen landing-glow-bg relative overflow-hidden">
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      {/* Hero Section */}
      <div className="relative">
        <div className="max-w-4xl mx-auto px-4 pt-32 pb-24 text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
            <span className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
              {t('title')}
            </span>
          </h1>
          <p className="text-2xl md:text-3xl text-foreground/90 font-medium mb-4">
            {t('subtitle')}
          </p>
          <p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto mb-10 whitespace-pre-line">
            {t('description')}
          </p>
          <Button
            variant="primary"
            size="lg"
            loading={isLoading}
            onClick={handleTryIt}
            className="px-8 py-6 text-xl rounded-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 font-bold"
          >
            {isLoading ? tCommon('loading') : t('get_started')}
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 space-y-32 pb-32 relative z-10">
        {/* Pain Point + Demo Section - Left Text, Right Image */}
        <div className="demo-section grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <div className="space-y-6 text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-bold leading-tight whitespace-pre-line">
              {t('pain_point_title')}
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed whitespace-pre-line">
              {t('pain_point_body')}
            </p>
          </div>

          {/* Right: Visual */}
          <div className="demo-visual relative mx-auto w-full max-w-lg md:max-w-none">
            <img
              src="/demo-screenshot.png"
              alt="TubeSummary Demo"
              className="demo-frame w-full h-auto"
            />
          </div>
        </div>

        {/* Tutorial Section - Glass Cards */}
        <div className="tutorial-section">
          <h2 className="text-3xl font-bold text-center mb-16">{t('tutorial_title')}</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Web Users Card */}
            <div className="glass-card space-y-8 hover:bg-white/10 transition-colors duration-300">
              <h3 className="text-2xl font-semibold flex items-center gap-3 text-orange-500">
                <Monitor className="w-6 h-6" /> {t('tutorial_web_title')}
              </h3>
              <div className="space-y-6">
                <StepItem
                  icon={<LogIn className="w-5 h-5" />}
                  text={t('tutorial_web_step1')}
                />
                <StepItem
                  icon={<PlusCircle className="w-5 h-5" />}
                  text={t('tutorial_web_step2')}
                />
                <StepItem
                  icon={<FileText className="w-5 h-5" />}
                  text={t('tutorial_web_step3')}
                />
                <StepItem
                  icon={<RefreshCw className="w-5 h-5" />}
                  text={t('tutorial_web_step4')}
                />
              </div>
            </div>

            {/* RSS Users Card */}
            <div className="glass-card space-y-8 hover:bg-white/10 transition-colors duration-300">
              <h3 className="text-2xl font-semibold flex items-center gap-3 text-purple-500">
                <Rss className="w-6 h-6" /> {t('tutorial_rss_title')}
              </h3>
              <div className="space-y-6">
                <StepItem
                  icon={<LogIn className="w-5 h-5" />}
                  text={t('tutorial_rss_step1')}
                />
                <StepItem
                  icon={<Link className="w-5 h-5" />}
                  text={t('tutorial_rss_step2')}
                />
                <StepItem
                  icon={<Mail className="w-5 h-5" />}
                  text={t('tutorial_rss_step3')}
                />
                <StepItem
                  icon={<Radio className="w-5 h-5" />}
                  text={t('tutorial_rss_step4')}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="text-center pt-8 border-t border-border/10">
          <p className="text-sm text-muted-foreground">
            {t('footer')}
          </p>
        </div>
      </div>
    </main>
  );
}

function StepItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white">
        {icon}
      </div>
      <p className="text-lg text-foreground font-medium pt-1.5">{text}</p>
    </div>
  );
}
