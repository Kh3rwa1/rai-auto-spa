import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
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

const Email = ({ name, vehicle, plan, date, time, location, videoUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Your ${vehicle ?? 'car'} is ready to shine ${date ?? ''} ${time ?? ''} — watch your reveal`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>RAI&apos;S AUTO SPA · GANGTOK</Text>
        <Heading style={h1}>Your {vehicle ?? 'car'} is ready to shine ✨</Heading>
        <Text style={text}>
          Hi{name ? ` ${name}` : ''}, your cinematic reveal video is ready. {plan ?? 'Your booking'} · {date ?? ''} at {time ?? ''} · {location ?? ''}.
        </Text>

        {videoUrl ? (
          <Button href={videoUrl} style={button}>
            ▶ Watch your 6-second reveal
          </Button>
        ) : null}

        <Section style={card}>
          <Text style={row}>
            <strong>{location?.includes('van') ? "Rai's van is coming to you" : 'See you at the studio'}</strong> —{' '}
            {date ?? ''} at {time ?? ''}. Water beading, glossy paint, the works.
          </Text>
        </Section>

        <Text style={footer}>Rai&apos;s Auto Spa · MG Marg, Gangtok, Sikkim 737101</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Your ${d['vehicle'] ?? 'car'} is ready to shine ${d['date'] ?? ''} ${d['time'] ?? ''} — Rai's Auto Spa`,
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

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const brand = { color: '#0D9488', fontSize: '12px', fontWeight: 700 as const, letterSpacing: '2px' }
const h1 = { color: '#111827', fontSize: '28px', margin: '8px 0 12px' }
const text = { color: '#374151', fontSize: '15px', lineHeight: '22px' }
const card = { backgroundColor: '#F9FAFB', borderRadius: '12px', padding: '16px 20px', margin: '16px 0' }
const row = { color: '#111827', fontSize: '14px', margin: '6px 0' }
const button = {
  backgroundColor: '#2563EB',
  color: '#ffffff',
  borderRadius: '10px',
  padding: '12px 20px',
  fontSize: '14px',
  fontWeight: 600 as const,
  textDecoration: 'none',
  display: 'inline-block',
  marginTop: '8px',
}
const footer = { color: '#9CA3AF', fontSize: '12px', marginTop: '24px' }
