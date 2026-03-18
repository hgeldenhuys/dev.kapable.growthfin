import { Separator } from '~/components/ui/separator';
import { Linkedin, Twitter, Facebook, Mail } from 'lucide-react';
import { trackEvent } from '~/lib/posthog';

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'How It Works', href: '#solution' },
    { label: 'ROI Calculator', href: '#' }
  ],
  company: [
    { label: 'About Us', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Contact', href: '#' }
  ],
  legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'POPIA Compliance', href: '#' },
    { label: 'Cookie Policy', href: '#' }
  ],
  resources: [
    { label: 'Documentation', href: '#' },
    { label: 'API Reference', href: '#' },
    { label: 'Case Studies', href: '#' },
    { label: 'Help Center', href: '#' }
  ]
};

const socialLinks = [
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Facebook, href: '#', label: 'Facebook' },
  { icon: Mail, href: 'mailto:hello@acmecorp.com', label: 'Email' }
];

export function Footer() {
  const handleLinkClick = (section: string, label: string) => {
    trackEvent('footer_link_clicked', {
      section,
      label
    });
  };

  const handleSocialClick = (platform: string) => {
    trackEvent('social_link_clicked', {
      platform,
      location: 'footer'
    });
  };

  return (
    <footer className="bg-growthfin-dark dark:bg-gray-950 text-white border-t border-gray-800 dark:border-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <div className="text-2xl font-bold bg-gradient-to-r from-growthfin-primary to-growthfin-secondary bg-clip-text text-transparent mb-4">
              ACME CORP
            </div>
            <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">
              AI-powered Sales Development as a Service. Scale your outbound 10x.
            </p>
            {/* Social Links */}
            <div className="flex gap-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    onClick={() => handleSocialClick(social.label)}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    aria-label={social.label}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="font-semibold text-white dark:text-white mb-4">Product</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={() => handleLinkClick('product', link.label)}
                    className="text-gray-400 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="font-semibold text-white dark:text-white mb-4">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={() => handleLinkClick('company', link.label)}
                    className="text-gray-400 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="font-semibold text-white dark:text-white mb-4">Resources</h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={() => handleLinkClick('resources', link.label)}
                    className="text-gray-400 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold text-white dark:text-white mb-4">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={() => handleLinkClick('legal', link.label)}
                    className="text-gray-400 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="bg-white/10 dark:bg-gray-800 mb-8" />

        {/* Bottom Footer */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400 dark:text-gray-500">
          <p>
            © {new Date().getFullYear()} ACME CORP. All rights reserved.
          </p>
          <p>
            Made with AI in South Africa 🇿🇦
          </p>
        </div>
      </div>
    </footer>
  );
}
