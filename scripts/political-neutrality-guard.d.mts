export declare function assessPoliticalNeutrality(text?: string): { political: boolean; blocked: boolean; reasons: string[] };
export declare function validatePoliticalNeutrality(input?: { title?: string; description?: string; content?: string }): { passed: boolean; political: boolean; blocked: boolean; reasons: string[] };
