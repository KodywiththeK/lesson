import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  render,
} from "@react-email/components";

import type { MorningBrief } from "@/domain/morning-brief";

/**
 * 메일 앱은 CSS 변수·외부 스타일을 읽지 못해 디자인 토큰 대신 같은 계열 색을 인라인으로 쓴다.
 * (globals.css의 --primary·--foreground·--muted-foreground·--border와 맞춘 값)
 */
const colors = {
  primary: "#1f64eb",
  text: "#1e293b",
  muted: "#64748b",
  border: "#e2e8f0",
  surface: "#f8fafc",
  warning: "#b45309",
};

const styles = {
  body: { backgroundColor: colors.surface, fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", margin: 0 },
  container: { backgroundColor: "#ffffff", maxWidth: "560px", margin: "0 auto", padding: "24px 20px" },
  heading: { color: colors.text, fontSize: "20px", margin: "0 0 4px" },
  subheading: { color: colors.text, fontSize: "16px", margin: "24px 0 8px" },
  muted: { color: colors.muted, fontSize: "13px", margin: "0" },
  summaryCell: {
    border: `1px solid ${colors.border}`,
    borderRadius: "8px",
    padding: "10px 0",
    textAlign: "center" as const,
    width: "25%",
  },
  summaryValue: { color: colors.text, fontSize: "20px", fontWeight: 700, margin: 0 },
  row: { color: colors.text, fontSize: "14px", margin: "4px 0" },
  notice: { color: colors.warning, fontSize: "14px", fontWeight: 600, margin: "12px 0 0" },
  link: { color: colors.primary, fontSize: "13px" },
  hr: { borderColor: colors.border, margin: "24px 0 12px" },
};

function MorningBriefEmail({ brief, appBaseUrl }: { brief: MorningBrief; appBaseUrl: string }) {
  const toAppUrl = (href: string) => new URL(href, appBaseUrl).href;

  return (
    <Html lang="ko">
      <Head />
      <Preview>{brief.subject}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading as="h1" style={styles.heading}>
            {brief.dateLabel} 아침 브리핑
          </Heading>
          <Text style={styles.muted}>오늘 레슨과 챙길 일을 정리했습니다.</Text>

          <Section style={{ marginTop: "16px" }}>
            <table width="100%" cellPadding={0} cellSpacing={6} role="presentation">
              <tbody>
                <tr>
                  {brief.summary.map((item) => (
                    <td key={item.label} style={styles.summaryCell}>
                      <p style={styles.summaryValue}>{item.value}</p>
                      <p style={styles.muted}>{item.label}</p>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            {brief.closures.length > 0 ? (
              <Text style={styles.notice}>오늘 휴원: {brief.closures.join(", ")}</Text>
            ) : null}
            {brief.memoNotice ? <Text style={styles.notice}>{brief.memoNotice}</Text> : null}
          </Section>

          <Heading as="h2" style={styles.subheading}>
            오늘 시간표
          </Heading>
          {brief.schedule.length === 0 ? (
            <Text style={styles.muted}>오늘 예정된 레슨이 없습니다.</Text>
          ) : (
            brief.schedule.map((group) => (
              <Section key={group.teacherName} style={{ marginBottom: "8px" }}>
                <Text style={{ ...styles.row, fontWeight: 700 }}>
                  {group.teacherName} ({group.lessons.length}건)
                </Text>
                {group.lessons.map((lesson) => (
                  <Text key={`${lesson.time}-${lesson.studentName}`} style={styles.row}>
                    {lesson.time} {lesson.studentName} · {lesson.instrumentName}
                    {lesson.tag ? ` [${lesson.tag}]` : ""}
                  </Text>
                ))}
              </Section>
            ))
          )}
          <Link href={toAppUrl("/lessons/academy")} style={styles.link}>
            레슨표 앱에서 보기
          </Link>

          <Heading as="h2" style={styles.subheading}>
            오늘 할 일
          </Heading>
          {brief.taskSections.length === 0 ? (
            <Text style={styles.muted}>오늘 챙길 일이 없습니다.</Text>
          ) : (
            brief.taskSections.map((section) => (
              <Section key={section.title} style={{ marginBottom: "12px" }}>
                <Text style={{ ...styles.row, fontWeight: 700 }}>
                  {section.title} ({section.items.length}건)
                </Text>
                {section.items.map((item) => (
                  <Text key={item.title} style={styles.row}>
                    {item.href ? (
                      <Link href={toAppUrl(item.href)} style={{ color: colors.text }}>
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                    <br />
                    <span style={styles.muted}>{item.detail}</span>
                  </Text>
                ))}
              </Section>
            ))
          )}
          <Link href={toAppUrl("/")} style={styles.link}>
            오늘 할 일 앱에서 처리하기
          </Link>

          <Hr style={styles.hr} />
          <Text style={styles.muted}>
            메일 받기는{" "}
            <Link href={toAppUrl("/me/notifications")} style={styles.link}>
              내 알림 설정
            </Link>
            에서 끌 수 있습니다.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderMorningBriefEmail(brief: MorningBrief, appBaseUrl: string) {
  const element = <MorningBriefEmail brief={brief} appBaseUrl={appBaseUrl} />;

  return {
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}
