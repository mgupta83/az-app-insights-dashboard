import { describe, expect, it } from 'vitest'
import { renderQueryTemplate } from './index'

describe('renderQueryTemplate', () => {
  it('replaces named parameters while keeping unresolved placeholders', () => {
    const rendered = renderQueryTemplate('traces | where severityLevel >= {{level}} | where cloud_RoleName == "{{role}}"', [
      { name: 'level', value: '2' },
    ])

    expect(rendered).toContain('severityLevel >= 2')
    expect(rendered).toContain('{{role}}')
  })
})
