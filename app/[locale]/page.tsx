"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "@/routing";
import { useEffect, useState } from "react";
import { Loader2, Play, Podcast, Rss } from "lucide-react";
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
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/20 relative">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
        <div className="text-center space-y-6">
          {/* Logo */}
          <h1 className="text-5xl md:text-6xl font-bold">
            <span className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
              {t('title')}
            </span>
          </h1>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}
          </p>

          <p className="text-lg text-muted-foreground/80">
            {t('description')}
          </p>

          {/* CTA Button */}
          <div className="pt-8">
            <Button
              variant="primary"
              size="lg"
              loading={isLoading}
              onClick={handleTryIt}
              className="px-8 py-4 text-lg rounded-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              {isLoading ? tCommon('loading') : t('get_started')}
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Play className="w-8 h-8" />}
            title={t('features.youtube.title')}
            description={t('features.youtube.desc')}
          />
          <FeatureCard
            icon={<Podcast className="w-8 h-8" />}
            title={t('features.podcast.title')}
            description={t('features.podcast.desc')}
          />
          <FeatureCard
            icon={<Rss className="w-8 h-8" />}
            title={t('features.rss.title')}
            description={t('features.rss.desc')}
          />
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          {t('footer')}
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-2xl bg-card border border-border/50 hover:border-border transition-colors">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/10 flex items-center justify-center text-orange-500 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
