---
name: Work Helper Operations
version: 0.1.0
colors:
  canvas: "#F6F7F9"
  surface: "#FFFFFF"
  surfaceSubtle: "#F9FAFB"
  ink: "#111827"
  text: "#374151"
  muted: "#6B7280"
  border: "#D9DEE7"
  borderSubtle: "#E5E7EB"
  accent: "#0F766E"
  accentHover: "#115E59"
  accentSubtle: "#E6F4F1"
  success: "#047857"
  warning: "#B45309"
  danger: "#B91C1C"
  info: "#1D4ED8"
typography:
  display:
    fontFamily: Geist
    fontSize: 1.5rem
    fontWeight: 650
    lineHeight: 2rem
  section-title:
    fontFamily: Geist
    fontSize: 1.125rem
    fontWeight: 650
    lineHeight: 1.75rem
  body:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5rem
  label:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: 550
    lineHeight: 1.25rem
  metric:
    fontFamily: Geist Mono
    fontSize: 1.5rem
    fontWeight: 650
    lineHeight: 2rem
rounded:
  sm: 4px
  md: 6px
  lg: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  xxl: 32px
components:
  button-primary:
    backgroundColor: "#111827"
    textColor: "#FFFFFF"
    borderRadius: 6px
    height: 40px
  input:
    backgroundColor: "#FFFFFF"
    borderColor: "#D9DEE7"
    textColor: "#111827"
    borderRadius: 6px
    height: 40px
  panel:
    backgroundColor: "#FFFFFF"
    borderColor: "#D9DEE7"
    borderRadius: 6px
  badge:
    borderRadius: 6px
    height: 28px
---

## Overview

Work Helper Operations is an internal production operations interface. It should
feel like a durable team console, not a marketing page or a prototype. The UI is
optimized for repeated task creation, scanning Notion sync state, and editing
video production subtasks with low cognitive load.

## Layout

Use a light canvas with white panels and restrained borders. Keep the first
screen focused on the actual workflow: publish on the left, track and edit on the
right. Avoid decorative hero areas, nested cards, oversized typography, and
ornamental gradients.

## Color

The palette is neutral-first. Teal is reserved for synchronization health,
primary workflow emphasis, and save actions. Status color should be semantic:
green for complete or healthy, amber for attention, red for failure or blocked,
and blue for in-progress work.

## Components

Controls should be compact and predictable. Inputs, selects, buttons, badges, and
table rows use 4-8px radius. Tables and editable rows are preferred over card
stacks for subtasks because the main user job is comparison and repeated editing.

## Interaction

Every Notion-backed object should expose its editable fields in the local UI.
Main task edits update the main row. Subtask edits update the independent Notion
task row and refresh the parent page index. Links to Notion should be present but
secondary to the local workflow.
