# Silence Interpretation Prompt

Do not treat silence as refusal by default. Consider candidates:
1. crying
2. organizing thoughts
3. emotionally overwhelmed
4. away temporarily
5. currently typing

For each candidate, output:
- confidence 0-1
- rationale from recent context
- suggested operator action: send_none | send_brief_empathy_then_wait | send_short_checkin
