// Fixtures mirroring the examples shipped in
// plugin/skills/formio-form/references/validation.md, conditionals.md,
// calculated-values.md, and field-logic.md — keep the two in sync.

export const validationFormDefinition: Record<string, unknown> = {
  display: 'form',
  components: [
    {
      type: 'textfield',
      key: 'name',
      label: 'Name',
      input: true,
      validate: {
        json: {
          if: [{ '===': [{ var: 'input' }, 'Bob'] }, true, "Your name must be 'Bob'!"],
        },
      },
    },
    {
      type: 'button',
      key: 'submit',
      label: 'Submit',
      action: 'submit',
      input: true,
    },
  ],
};

export const jsonConditionalFormDefinition: Record<string, unknown> = {
  display: 'form',
  components: [
    {
      type: 'textfield',
      key: 'employed',
      label: 'Are you employed? (yes/no)',
      input: true,
    },
    {
      type: 'textfield',
      key: 'employer',
      label: 'Employer',
      input: true,
      conditional: {
        json: { '===': [{ var: 'data.employed' }, 'yes'] },
      },
    },
  ],
};

export const simpleConditionalFormDefinition: Record<string, unknown> = {
  display: 'form',
  components: [
    {
      type: 'textfield',
      key: 'employed',
      label: 'Are you employed? (yes/no)',
      input: true,
    },
    {
      type: 'textfield',
      key: 'employer',
      label: 'Employer',
      input: true,
      conditional: {
        show: true,
        when: 'employed',
        eq: 'yes',
      },
    },
  ],
};

export const calculatedFormDefinition: Record<string, unknown> = {
  display: 'form',
  components: [
    {
      type: 'number',
      key: 'quantity',
      label: 'Quantity',
      input: true,
    },
    {
      type: 'number',
      key: 'price',
      label: 'Price',
      input: true,
    },
    {
      type: 'number',
      key: 'total',
      label: 'Total',
      input: true,
      calculateValue: {
        '*': [{ var: 'data.quantity' }, { var: 'data.price' }],
      },
    },
  ],
};

export const fieldLogicFormDefinition: Record<string, unknown> = {
  display: 'form',
  components: [
    {
      type: 'textfield',
      key: 'status',
      label: 'Status',
      input: true,
    },
    {
      type: 'textfield',
      key: 'notes',
      label: 'Notes',
      input: true,
      logic: [
        {
          name: 'lock notes while status is locked',
          trigger: {
            type: 'json',
            json: { '===': [{ var: 'data.status' }, 'locked'] },
          },
          actions: [
            {
              name: 'disable notes',
              type: 'property',
              property: {
                label: 'Disabled',
                value: 'disabled',
                type: 'boolean',
              },
              state: true,
            },
          ],
        },
      ],
    },
  ],
};
