import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";

export function TableEmpty({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <Box textAlign="center" color="inherit" padding={{ vertical: "l" }}>
      <SpaceBetween size="xxs">
        <Box variant="strong" color="inherit">
          {title}
        </Box>
        {subtitle && (
          <Box variant="p" color="inherit">
            {subtitle}
          </Box>
        )}
      </SpaceBetween>
      {action && <Box padding={{ top: "s" }}>{action}</Box>}
    </Box>
  );
}
