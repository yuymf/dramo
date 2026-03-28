"use client";

import { useState } from 'react';
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check } from "lucide-react";
import { useSubscription } from '@/lib/hooks/use-subscription';
import { createCheckoutSession, createPortalSession } from '@/lib/api/billing';
import type { BillingInterval, PlanId } from '@/lib/billing/types';

interface PlanConfig {
  readonly id: PlanId;
  readonly name: string;
  readonly monthlyPrice: string;
  readonly yearlyPrice: string;
  readonly yearlySavings: string;
  readonly features: readonly string[];
  readonly highlighted: boolean;
}

const PLANS: readonly PlanConfig[] = [
  {
    id: 'free',
    name: '免费版',
    monthlyPrice: '¥0',
    yearlyPrice: '¥0',
    yearlySavings: '',
    features: ['1 个项目', '基础 AI 功能（每日限量）', '线性剧本编辑', '5 个角色', '导出 TXT'],
    highlighted: false,
  },
  {
    id: 'pro',
    name: '专业版',
    monthlyPrice: '¥99',
    yearlyPrice: '¥999',
    yearlySavings: '省 17%',
    features: [
      '无限项目',
      '无限 AI 生成',
      '分支 + 故事板模式',
      '无限角色 + 关系图谱',
      '导出 DOCX / PDF',
      'AI 聊天助手',
      '优先支持',
    ],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: '企业版',
    monthlyPrice: '联系我们',
    yearlyPrice: '联系我们',
    yearlySavings: '',
    features: ['专业版所有功能', '无限团队成员', '专属客户经理', '定制化功能', 'SLA 保障'],
    highlighted: false,
  },
] as const;

export default function PricingPage() {
  const router = useRouter();
  const { status } = useSession();
  const { subscription, isPro } = useSubscription();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);

  const handleSelectPlan = async (plan: PlanConfig) => {
    if (plan.id === 'enterprise') {
      window.location.href = 'mailto:sales@dramo.ai';
      return;
    }

    if (plan.id === 'free') {
      router.push('/projects');
      return;
    }

    // Unauthenticated → login first
    if (status !== 'authenticated') {
      const params = new URLSearchParams({
        redirect: '/pricing',
        plan: plan.id,
        interval: billingInterval,
      });
      router.push(`/login?${params.toString()}`);
      return;
    }

    // Already on this plan → manage
    if (subscription?.planId === plan.id) {
      setLoadingPlan(plan.id);
      try {
        const { url } = await createPortalSession();
        window.location.href = url;
      } catch (error) {
        console.error('[Pricing] Portal session error:', error);
      } finally {
        setLoadingPlan(null);
      }
      return;
    }

    // Upgrade → Stripe Checkout
    setLoadingPlan(plan.id);
    try {
      const { url } = await createCheckoutSession(plan.id, billingInterval);
      window.location.href = url;
    } catch (error) {
      console.error('[Pricing] Checkout session error:', error);
    } finally {
      setLoadingPlan(null);
    }
  };

  const getCtaText = (plan: PlanConfig): string => {
    if (plan.id === 'enterprise') return '联系销售';
    if (status !== 'authenticated') return plan.id === 'free' ? '开始使用' : '立即订阅';
    if (subscription?.planId === plan.id) return '✓ 当前计划';
    if (plan.id === 'free') return '当前计划';
    if (isPro) return '管理订阅';
    return '升级 Pro';
  };

  const isCurrentPlan = (plan: PlanConfig): boolean =>
    status === 'authenticated' && subscription?.planId === plan.id;

  return (
    <div className="min-h-screen muji-paper-bg muji-paper-texture">
      <SiteHeader />

      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 space-y-4">
            <h1
              className="text-4xl lg:text-5xl font-semibold"
              style={{ color: "var(--muji-charcoal)" }}
            >
              订阅计划与价格
            </h1>
            <p
              className="text-lg max-w-2xl mx-auto"
              style={{ color: "var(--muji-dark-gray)" }}
            >
              从个人创作者到专业团队，总有适合你的选择
            </p>
          </div>

          {/* Billing interval toggle */}
          <div className="flex justify-center mb-12">
            <div
              className="inline-flex rounded-full p-1"
              style={{ background: 'var(--muji-oatmeal)' }}
            >
              <button
                onClick={() => setBillingInterval('month')}
                className="px-6 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  background: billingInterval === 'month' ? 'var(--muji-charcoal)' : 'transparent',
                  color: billingInterval === 'month' ? 'var(--muji-cream)' : 'var(--muji-dark-gray)',
                }}
              >
                月付
              </button>
              <button
                onClick={() => setBillingInterval('year')}
                className="px-6 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  background: billingInterval === 'year' ? 'var(--muji-charcoal)' : 'transparent',
                  color: billingInterval === 'year' ? 'var(--muji-cream)' : 'var(--muji-dark-gray)',
                }}
              >
                年付
                <span className="ml-1 text-xs opacity-75">省 17%</span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`paper-card rounded-lg p-8 transition-all ${
                  plan.highlighted ? "scale-105" : ""
                }`}
              >
                {plan.highlighted && (
                  <div
                    className="text-xs font-semibold mb-4 px-3 py-1 inline-block rounded-full"
                    style={{
                      background: "var(--muji-charcoal)",
                      color: "var(--muji-cream)",
                    }}
                  >
                    最受欢迎
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <h3
                      className="text-2xl font-semibold mb-2"
                      style={{ color: "var(--muji-charcoal)" }}
                    >
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span
                        className="text-4xl font-semibold"
                        style={{ color: "var(--muji-charcoal)" }}
                      >
                        {billingInterval === 'month' ? plan.monthlyPrice : plan.yearlyPrice}
                      </span>
                      {plan.id !== 'enterprise' && (
                        <span
                          className="text-lg"
                          style={{ color: "var(--muji-dark-gray)" }}
                        >
                          {billingInterval === 'month' ? '/月' : '/年'}
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2"
                        style={{ color: "var(--muji-dark-gray)" }}
                      >
                        <Check className="w-5 h-5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={isCurrentPlan(plan) || loadingPlan !== null}
                    className="w-full font-medium"
                    style={{
                      background: isCurrentPlan(plan)
                        ? 'var(--muji-oatmeal)'
                        : plan.highlighted
                          ? "var(--muji-charcoal)"
                          : "var(--muji-oatmeal)",
                      color: isCurrentPlan(plan)
                        ? 'var(--muji-dark-gray)'
                        : plan.highlighted
                          ? "var(--muji-cream)"
                          : "var(--muji-charcoal)",
                      border: "none",
                    }}
                    size="lg"
                  >
                    {loadingPlan === plan.id ? '跳转中...' : getCtaText(plan)}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative py-12 px-4 sm:px-6 lg:px-8 border-t"
        style={{ borderColor: "rgba(0, 0, 0, 0.06)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center" style={{ color: "var(--muji-dark-gray)" }}>
            <p className="text-sm">© 2026 DRAMO. 保留所有权利。</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
