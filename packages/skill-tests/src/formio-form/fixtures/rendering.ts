// Fixtures mirroring the examples shipped in
// plugin/skills/formio-form/references/rendering.md — keep the two in sync.

export const contactFormDefinition: Record<string, unknown> = {
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
    {
      type: 'button',
      key: 'submit',
      label: 'Submit',
      action: 'submit',
      input: true,
    },
  ],
};

export const prefillSubmission: { data: Record<string, unknown> } = {
  data: {
    firstName: 'Jane',
    lastName: 'Doe',
  },
};
