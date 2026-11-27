import type { Metadata } from "next";
import Link from "next/link";

import { LegalPageLayout } from "@/components/layout/legal-page-layout";

import { siteName } from "../seo";
import { serviceOperator } from "../service-info";

export const metadata: Metadata = {
  title: "이용약관",
  description: `${siteName} 이용약관`,
  alternates: { canonical: "/terms" },
};

/** 이용약관. 음악학원 관리 서비스에 맞춘 기본 약관(2026-11-27). */
export default function TermsPage() {
  const { name, email, openChatUrl } = serviceOperator;

  return (
    <LegalPageLayout title="이용약관">
      <section>
        <h2>제1조 (목적)</h2>
        <p>
          이 약관은 {name}(이하 &lsquo;운영자&rsquo;)가 제공하는 음악학원 관리 서비스 {siteName}(이하 &lsquo;서비스&rsquo;)의 이용 조건과
          절차, 운영자와 이용자의 권리·의무를 정합니다.
        </p>
      </section>

      <section>
        <h2>제2조 (정의)</h2>
        <ul>
          <li>이용자: 이 약관에 동의하고 서비스를 이용하는 원장·데스크·선생님</li>
          <li>학원: 원장이 서비스에 등록한 음악학원과 그 구성원</li>
          <li>학원 데이터: 학원이 서비스에 입력한 원생·선생님·상담·수업·수납 등의 정보</li>
        </ul>
      </section>

      <section>
        <h2>제3조 (약관의 효력과 변경)</h2>
        <p>
          이 약관은 서비스 화면에 게시해 효력이 생깁니다. 운영자는 관련 법령을 어기지 않는 범위에서 약관을 바꿀 수 있으며,
          바꾸면 시행 7일 전부터 서비스 화면에 알립니다. 이용자에게 불리한 변경은 30일 전부터 알립니다.
        </p>
      </section>

      <section>
        <h2>제4조 (서비스 내용)</h2>
        <p>
          서비스는 레슨 시간표·출결·보강, 원생·선생님 관리, 회차권·수강료·교재 수납, 급여 계산, 상담 관리, 오늘 할 일·알림 기능을 제공합니다.
          운영자는 서비스를 개선하기 위해 기능을 추가·변경할 수 있습니다.
        </p>
      </section>

      <section>
        <h2>제5조 (계정)</h2>
        <ul>
          <li>이용자는 카카오 계정으로 가입·로그인합니다.</li>
          <li>원장은 학원을 만들고, 데스크·선생님은 원장의 초대 또는 가입 승인을 받아 학원 구성원이 됩니다. 역할에 따라 볼 수 있는 화면과 정보가 다릅니다.</li>
          <li>이용자는 계정을 다른 사람과 함께 쓰거나 넘겨서는 안 되며, 계정 관리 소홀로 생긴 손해는 이용자가 책임집니다.</li>
        </ul>
      </section>

      <section>
        <h2>제6조 (학원이 입력하는 정보)</h2>
        <ul>
          <li>학원 데이터에 대한 권리와 책임은 해당 학원에 있습니다.</li>
          <li>학원은 원생·보호자·선생님·상담 신청자의 개인정보를 입력하기 전에 필요한 동의를 받는 등 관련 법령을 지켜야 합니다.</li>
          <li>운영자는 학원 데이터를 서비스 제공 목적으로만 처리하며, 자세한 내용은{" "}
            <Link className="underline" href="/privacy">개인정보처리방침</Link>을 따릅니다.
          </li>
        </ul>
      </section>

      <section>
        <h2>제7조 (이용자의 의무)</h2>
        <ul>
          <li>다른 사람의 정보를 도용하거나 사실과 다른 정보를 입력하지 않습니다.</li>
          <li>서비스를 해킹하거나 정상 운영을 방해하지 않습니다.</li>
          <li>서비스를 법령이나 공공질서에 어긋나는 목적으로 쓰지 않습니다.</li>
        </ul>
      </section>

      <section>
        <h2>제8조 (요금)</h2>
        <p>서비스 이용 요금과 결제 조건은 별도로 안내합니다. 유료로 바꾸거나 요금을 바꾸면 시행 30일 전부터 알립니다.</p>
      </section>

      <section>
        <h2>제9조 (서비스의 중단)</h2>
        <p>
          운영자는 시스템 점검·교체, 장애, 천재지변 등 부득이한 사유가 있으면 서비스를 일시 중단할 수 있으며, 미리 또는 사후에 알립니다.
        </p>
      </section>

      <section>
        <h2>제10조 (이용 종료)</h2>
        <p>
          이용자는 언제든지 탈퇴를 요청할 수 있습니다. 학원이 이용을 끝내면 학원 데이터는 개인정보처리방침에 따라 파기합니다.
          이용자가 제7조를 어기면 운영자는 이용을 제한할 수 있습니다.
        </p>
      </section>

      <section>
        <h2>제11조 (책임의 제한)</h2>
        <p>
          운영자는 천재지변, 이용자의 잘못, 학원이 입력한 정보의 오류로 생긴 손해에는 책임지지 않습니다. 다만 운영자의 고의 또는 중대한 과실로 생긴 손해는 예외입니다.
          서비스의 계산 결과(수납·급여 등)는 업무를 돕기 위한 것이며, 최종 확인은 학원이 합니다.
        </p>
      </section>

      <section>
        <h2>제12조 (분쟁 해결)</h2>
        <p>이 약관과 서비스 이용에 관한 분쟁은 대한민국 법을 따르며, 관할 법원은 민사소송법에 따릅니다.</p>
      </section>

      <section>
        <h2>문의</h2>
        <p>
          메일 <a className="underline" href={`mailto:${email}`}>{email}</a> 또는{" "}
          <a className="underline" href={openChatUrl} target="_blank" rel="noopener noreferrer">카카오톡 오픈채팅</a>으로 문의해 주세요.
        </p>
      </section>
    </LegalPageLayout>
  );
}
