// Fixtures mirroring the examples shipped in
// plugin/skills/formio-form/references/wizards.md and external-data.md —
// keep the two in sync.

export const conditionalWizardDefinition: Record<string, unknown> = {
  display: 'wizard',
  components: [
    {
      type: 'panel',
      key: 'basics',
      title: 'Basics',
      components: [
        {
          type: 'textfield',
          key: 'wantsExtras',
          label: 'Do you want extras? (yes/no)',
          input: true,
        },
      ],
    },
    {
      type: 'panel',
      key: 'extras',
      title: 'Extras',
      components: [
        {
          type: 'textfield',
          key: 'extraDetails',
          label: 'Extra Details',
          input: true,
        },
      ],
      conditional: {
        json: { '!==': [{ var: 'data.wantsExtras' }, 'no'] },
      },
    },
    {
      type: 'panel',
      key: 'confirmation',
      title: 'Confirmation',
      components: [
        {
          type: 'textfield',
          key: 'signature',
          label: 'Type your name to confirm',
          input: true,
        },
      ],
    },
  ],
};

export const externalDataFormDefinition: Record<string, unknown> = {
  display: 'form',
  components: [
    {
      type: 'textfield',
      key: 'firstName',
      label: 'First Name',
      input: true,
    },
    {
      type: 'textfield',
      key: 'lastName',
      label: 'Last Name',
      input: true,
    },
  ],
};
