import TasksContainer from "@/components/tasks/TasksContainer";

function Tasks() {
  return (
    <div className="col-span-3 flex h-full">
      <div className="flex-1">
        <TasksContainer />
      </div>
    </div>
  );
}

export default Tasks;
