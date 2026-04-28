export const MVP_ROLES = Object.freeze({
  PROGRAM_MANAGER: "program_manager",
  ENGINEERING_LEAD: "engineering_lead",
  OPERATOR_REPRESENTATIVE: "operator_representative",
  CUSTOMER_PM: "customer_pm",
  EXECUTIVE_VIEWER: "executive_viewer",
  AI_SYSTEM: "ai_system"
});

export const ROLE_LABELS = Object.freeze({
  [MVP_ROLES.PROGRAM_MANAGER]: "Program Manager",
  [MVP_ROLES.ENGINEERING_LEAD]: "Engineering Lead",
  [MVP_ROLES.OPERATOR_REPRESENTATIVE]: "Operator Representative",
  [MVP_ROLES.CUSTOMER_PM]: "Customer PM",
  [MVP_ROLES.EXECUTIVE_VIEWER]: "Executive Viewer",
  [MVP_ROLES.AI_SYSTEM]: "AI Assistant/System"
});

export const HUMAN_ROLES = Object.freeze([
  MVP_ROLES.PROGRAM_MANAGER,
  MVP_ROLES.ENGINEERING_LEAD,
  MVP_ROLES.OPERATOR_REPRESENTATIVE,
  MVP_ROLES.CUSTOMER_PM,
  MVP_ROLES.EXECUTIVE_VIEWER
]);

export function isMvpRole(role) {
  return Object.values(MVP_ROLES).includes(role);
}

export function isHumanRole(role) {
  return HUMAN_ROLES.includes(role);
}
