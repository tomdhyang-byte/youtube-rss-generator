import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from './Button';

export async function CTABanner() {
    const t = await getTranslations('Share');

    return (
        <div className="mt-8 p-6 bg-gradient-to-r from-orange-500/10 to-amber-500/10
                        rounded-xl border border-orange-500/20 text-center">
            <p className="text-lg mb-4">
                {t.rich('cta_title', {
                    brand: (chunks) => <strong className="text-orange-400">{chunks}</strong>
                })}
            </p>
            <p className="text-muted-foreground mb-4">
                {t('cta_subtitle')}
            </p>
            <Link href="/">
                <Button variant="primary">{t('cta_button')}</Button>
            </Link>
        </div>
    );
}
