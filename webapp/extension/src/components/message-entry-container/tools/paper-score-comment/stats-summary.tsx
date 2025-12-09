import { OverleafComment } from "../../../../pkg/gen/apiclient/project/v1/project_pb";

type StatsSummaryProps = {
  comments: OverleafComment[];
};

export const StatsSummary = ({ comments }: StatsSummaryProps) => {
  return (
    <div className="!bg-primary-100 !rounded-lg !p-4 !mb-2 noselect overflow-hidden">
      <h3 className="!text-xs !font-semibold !text-primary-700 !mb-2 text-nowrap text-ellipsis overflow-hidden">
        We have some suggestions for you
      </h3>
      <div className="flex flex-row flex-wrap !items-baseline !gap-2 !justify-between relative">
        <div className="text-3xl font-bold text-primary-900">
          {comments.filter((comment) => comment.importance === "Critical").length}
          <span className="!ml-2 !text-lg !text-primary-700">Critical</span>
        </div>

        <div className="text-3xl font-bold text-primary-900">
          {comments.filter((comment) => comment.importance === "High").length}
          <span className="!ml-2 !text-lg !text-primary-700">High</span>
        </div>

        <div className="text-3xl font-bold text-primary-900">
          {comments.filter((comment) => comment.importance === "Medium").length}
          <span className="!ml-2 !text-lg !text-primary-700">Medium</span>
        </div>
      </div>
      <p className="!mt-2 !text-xs !text-primary-700 text-nowrap text-ellipsis overflow-hidden">
        Apply our suggestions to improve your paper score
      </p>
    </div>
  );
};
