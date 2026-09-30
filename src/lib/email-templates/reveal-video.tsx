import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  vehicle?: string
  plan?: string
  date?: string
  time?: string
  location?: string
  videoUrl?: string
}

const formatDate = (value?: string) => {
  if (!value) return 'your booked date'
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

const formatTime = (value?: string) => {
  if (!value) return 'your booked time'
  const [hours = '', minutes = ''] = value.split(':')
  const hour = Number(hours)
  if (!Number.isFinite(hour)) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes || '00'} ${suffix}`
}

const Email = ({ name, vehicle, plan, date, time, location, videoUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{location?.includes('van') ? `Rai is coming to transform your ${vehicle ?? 'car'}` : `See how Rai will transform your ${vehicle ?? 'car'}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBlock}>
          <Text style={brand}>RAI&apos;S AUTO SPA</Text>
          <Text style={place}>MG MARG · GANGTOK</Text>
        </Section>

        <Heading style={h1}>
          {location?.includes('van')
            ? `Rai is coming to transform your ${vehicle ?? 'car'}.`
            : `Here’s what Rai has planned for your ${vehicle ?? 'car'}.`}
        </Heading>
        <Text style={text}>
          Hi{name ? ` ${name}` : ''}, here&apos;s a first look at the transformation Rai has planned for your car.
        </Text>

        {videoUrl ? (
          <Button href={videoUrl} style={button}>
            See your car&apos;s transformation&nbsp; →
          </Button>
        ) : null}

        <Section style={card}>
          <Text style={cardLabel}>{location?.includes('van') ? 'RAI COMES TO YOU' : 'YOUR VISIT TO THE STUDIO'}</Text>
          <Text style={cardTitle}>{plan ?? 'Your car care appointment'}</Text>
          <Hr style={hr} />
          <Text style={row}><strong>When</strong><br />{formatDate(date)} · {formatTime(time)}</Text>
          <Text style={row}><strong>Where</strong><br />{location?.replace(/\s*\(Rai's van comes to you\)\s*/i, '') || 'Rai’s Auto Spa, MG Marg'}</Text>
        </Section>

        <Text style={note}>Rai will take care of the rest. See you soon.</Text>
        <Text style={footer}>Rai&apos;s Auto Spa · MG Marg, Gangtok</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => d['location']?.includes('van')
    ? `Rai is coming to transform your ${d['vehicle'] ?? 'car'} — ${formatDate(d['date'])}`
    : `Your ${d['vehicle'] ?? 'car'} transformation at Rai's — ${formatDate(d['date'])}`,
  displayName: 'Reveal video ready',
  previewData: {
    name: 'Pema',
    vehicle: 'Maruti Swift',
    plan: 'Full Detail',
    date: '2026-10-02',
    time: '08:00',
    location: "Tadong (Rai's van comes to you)",
    videoUrl: 'https://example.com/reveal.mp4',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: '0' }
const container = { padding: '36px 24px', maxWidth: '560px' }
const brandBlock = { borderLeft: '4px solid #0D9488', paddingLeft: '14px', marginBottom: '32px' }
const brand = { color: '#111827', fontSize: '13px', fontWeight: 700 as const, letterSpacing: '2px', margin: '0 0 4px' }
const place = { color: '#0D9488', fontSize: '11px', fontWeight: 700 as const, letterSpacing: '2px', margin: '0' }
const h1 = { color: '#111827', fontSize: '34px', lineHeight: '40px', margin: '0 0 18px' }
const text = { color: '#4B5563', fontSize: '16px', lineHeight: '25px', margin: '0 0 24px' }
const card = { backgroundColor: '#F3F7F6', borderRadius: '8px', padding: '22px', margin: '28px 0 22px' }
const cardLabel = { color: '#0D9488', fontSize: '11px', fontWeight: 700 as const, letterSpacing: '2px', margin: '0 0 8px' }
const cardTitle = { color: '#111827', fontSize: '20px', fontWeight: 700 as const, margin: '0' }
const hr = { borderColor: '#D7E2DF', margin: '18px 0' }
const row = { color: '#374151', fontSize: '14px', lineHeight: '21px', margin: '12px 0' }
const button = {
  backgroundColor: '#2563EB',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '15px 22px',
  fontSize: '15px',
  fontWeight: 700 as const,
  textDecoration: 'none',
  display: 'inline-block',
}
const note = { color: '#374151', fontSize: '14px', lineHeight: '21px', margin: '0 0 28px' }
const footer = { color: '#9CA3AF', fontSize: '12px', borderTop: '1px solid #E5E7EB', paddingTop: '18px' }
