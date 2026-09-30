import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
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
  total?: number
  deposit?: number
  previewUrl?: string
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

const Email = ({ name, vehicle, plan, date, time, location, total, deposit, previewUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`You're booked — ${plan ?? 'your wash'} on ${date ?? ''} at ${time ?? ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>RAI&apos;S AUTO SPA · GANGTOK</Text>
        <Heading style={h1}>You&apos;re booked 🔥</Heading>
        <Text style={text}>Hi{name ? ` ${name}` : ''}, your slot is locked in. Here&apos;s everything:</Text>

        {previewUrl ? <Img src={previewUrl} alt="Your car, cleaned by AI preview" style={img} /> : null}

        <Section style={card}>
          <Text style={row}><strong>Plan:</strong> {plan ?? '—'}</Text>
          <Text style={row}><strong>Vehicle:</strong> {vehicle ?? '—'}</Text>
          <Text style={row}><strong>When:</strong> {date ?? '—'} at {time ?? '—'}</Text>
          <Text style={row}><strong>Where:</strong> {location ?? '—'}</Text>
          <Hr style={hr} />
          <Text style={row}><strong>Deposit paid:</strong> {typeof deposit === 'number' ? inr(deposit) : '—'}</Text>
          <Text style={row}><strong>Balance on the day:</strong> {typeof total === 'number' && typeof deposit === 'number' ? inr(total - deposit) : '—'}</Text>
        </Section>

        <Text style={text}>
          Reschedule is free till 12 hours before your slot — just reply to this email or WhatsApp Rai.
        </Text>

        <Button href="https://maps.google.com/?q=MG+Marg+Gangtok+Sikkim" style={button}>
          Open map to the studio
        </Button>

        <Text style={footer}>Rai&apos;s Auto Spa · MG Marg, Gangtok, Sikkim 737101</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `You're booked — ${d['plan'] ?? 'your wash'} on ${d['date'] ?? ''} at ${d['time'] ?? ''} · Rai's Auto Spa`,
  displayName: 'Booking confirmation',
  previewData: {
    name: 'Pema',
    vehicle: 'Maruti Swift',
    plan: 'Full Detail',
    date: '2026-10-02',
    time: '08:00',
    location: 'Studio, MG Marg, Gangtok',
    total: 1999,
    deposit: 600,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const brand = { color: '#0D9488', fontSize: '12px', fontWeight: 700 as const, letterSpacing: '2px' }
const h1 = { color: '#111827', fontSize: '28px', margin: '8px 0 12px' }
const text = { color: '#374151', fontSize: '15px', lineHeight: '22px' }
const img = { width: '100%', borderRadius: '12px', margin: '12px 0' }
const card = { backgroundColor: '#F9FAFB', borderRadius: '12px', padding: '16px 20px', margin: '16px 0' }
const row = { color: '#111827', fontSize: '14px', margin: '6px 0' }
const hr = { borderColor: '#E5E7EB', margin: '10px 0' }
const button = {
  backgroundColor: '#0D9488',
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
