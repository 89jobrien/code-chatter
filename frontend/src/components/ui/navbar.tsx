'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Sparkles, 
  MessageCircle, 
  Bot, 
  Code2,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navItems: NavItem[] = [
  {
    href: '/',
    label: 'Code Analysis',
    icon: Code2,
    description: 'Chat with your codebase'
  },
  {
    href: '/chatbot',
    label: 'AI Chatbot',
    icon: Bot,
    description: 'General AI assistant'
  }
];

export function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="relative">
              <Sparkles className="h-6 w-6 text-primary" />
              <div className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-pulse" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Code Chatter
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "flex items-center space-x-2 h-10 px-4",
                      isActive && "shadow-sm"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={toggleMobileMenu}
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t">
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <div key={item.href}>
                    <Link 
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <div className={cn(
                        "flex items-center space-x-3 p-3 rounded-lg transition-colors",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "hover:bg-muted"
                      )}>
                        <Icon className="h-5 w-5" />
                        <div>
                          <div className="font-medium">{item.label}</div>
                          <div className={cn(
                            "text-sm",
                            isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>
                            {item.description}
                          </div>
                        </div>
                      </div>
                    </Link>
                    {index < navItems.length - 1 && (
                      <Separator className="my-2" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
