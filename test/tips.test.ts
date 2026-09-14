import { describe, expect, it } from 'vitest';
import { Renderer } from '../src/Renderer.js';

describe('tips plugin', () => {
  const r = new Renderer({ mindmap: false, codeHighlight: false, math: false });

  it('renders a :::notice block', () => {
    const html = r.render(':::notice\n\nThis is a notice.\n\n:::');
    expect(html).toContain('md-editor-tip--notice');
    expect(html).toContain('This is a notice.');
  });

  it('renders a :::warning block with custom title', () => {
    const html = r.render(':::warning Watch out!\n\nDanger ahead.\n\n:::');
    expect(html).toContain('md-editor-tip--warning');
    expect(html).toContain('Watch out!');
    expect(html).toContain('Danger ahead.');
  });

  it('does not leak closing ::: into the body', () => {
    const html = r.render(':::warning Tip title\n\nYour tip content here.\n\n:::');
    // The closing ::: should not appear as visible text in the rendered output
    expect(html).not.toMatch(/<p>\s*:::\s*<\/p>/);
    expect(html).not.toContain(':::');
  });

  it('renders all supported tip types', () => {
    const types = ['notice', 'info', 'tip', 'warning', 'danger', 'success'];
    for (const type of types) {
      const html = r.render(`:::${type}\n\nContent.\n\n:::`);
      expect(html).toContain(`md-editor-tip--${type}`);
    }
  });

  it('renders markdown inside tip body', () => {
    const html = r.render(':::tip\n\n**Bold** and *italic* text.\n\n:::');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('uses default title when none provided', () => {
    const html = r.render(':::danger\n\nContent.\n\n:::');
    expect(html).toContain('Danger');
  });

  it('does not render unknown types as tips', () => {
    const html = r.render(':::unknown\n\nContent.\n\n:::');
    expect(html).not.toContain('md-editor-tip');
  });

  it('does not render unclosed tip blocks', () => {
    const html = r.render(':::notice\n\nUnclosed content.');
    expect(html).not.toContain('md-editor-tip');
  });

  it('renders tip with icon', () => {
    const html = r.render(':::tip\n\nContent.\n\n:::');
    expect(html).toContain('md-editor-tip-icon');
  });
});

describe('tips plugin - disabled', () => {
  it('does not render tips when tips option is false', () => {
    const r = new Renderer({ tips: false, mindmap: false, codeHighlight: false, math: false });
    const html = r.render(':::notice\n\nContent.\n\n:::');
    expect(html).not.toContain('md-editor-tip');
  });
});
