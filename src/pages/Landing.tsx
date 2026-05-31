import { useLang } from "@/store/LangContext";
import { useState, useEffect } from "react";
import heroImg from "@/assets/hero-new.jpg";
import featureInstant from "@/assets/feature-instant.jpg";
import featureSupport from "@/assets/feature-support.jpg";
import featureDevices from "@/assets/feature-devices.jpg";
import statClients from "@/assets/stat-clients.png";
import statChannels from "@/assets/stat-channels.png";
import statUptime from "@/assets/stat-uptime.png";
import statSatisfaction from "@/assets/stat-satisfaction.png";
import HeroSection from "@/components/landing/HeroSection";
import StatsBar from "@/components/landing/StatsBar";
import WhyChooseUs from "@/components/landing/WhyChooseUs";
import HowItWorks from "@/components/landing/HowItWorks";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import CtaSection from "@/components/landing/CtaSection";

const Landing = () => {
  const { t } = useLang();

  const features = [
    { img: featureInstant, title: t("benefit1Title"), desc: t("benefit1Desc") },
    { img: featureSupport, title: t("benefit2Title"), desc: t("benefit2Desc") },
    { img: featureDevices, title: t("benefit3Title"), desc: t("benefit3Desc") },
  ];

  const stats = [
    { img: statClients, value: "500+", label: t("statsResellers") },
    { img: statChannels, value: "10,000+", label: t("statsChannels") },
    { img: statUptime, value: "99.9%", label: t("statsUptime") },
    { img: statSatisfaction, value: "4.9/5", label: t("statsSatisfaction") },
  ];

  const testimonials = [
    { name: t("testimonial1Name"), text: t("testimonial1Text"), rating: 5 },
    { name: t("testimonial2Name"), text: t("testimonial2Text"), rating: 5 },
    { name: t("testimonial3Name"), text: t("testimonial3Text"), rating: 5 },
  ];

  return (
    <div>
      <HeroSection />
      <StatsBar stats={stats} />
      <HowItWorks />
      <WhyChooseUs features={features} />
    </div>
  );
};

export default Landing;
