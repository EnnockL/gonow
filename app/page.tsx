import Hero from '@/components/home/Hero'
import ServiceGrid from '@/components/home/ServiceGrid'
import HowItWorks from '@/components/home/HowItWorks'
import StatsBar from '@/components/home/StatsBar'
import AIFeature from '@/components/home/AIFeature'
import WhyGonow from '@/components/home/WhyGonow'
import CTASection from '@/components/home/CTASection'

export default function Home() {
  return (
    <>
      <Hero />
      <StatsBar />
      <AIFeature />
      <ServiceGrid />
      <HowItWorks />
      <WhyGonow />
      <CTASection />
    </>
  )
}
