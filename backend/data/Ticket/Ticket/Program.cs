using Microsoft.EntityFrameworkCore;
using Ticket.Data;
using Ticket.Middleware;
using Ticket.Services;

const string CorsPolicy = "AllowFrontend";

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

builder.Services.AddScoped<IReservationService, ReservationService>();
builder.Services.AddScoped<IReservationExpirationService, ReservationExpirationService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IPasswordHashService, PasswordHashService>();
builder.Services.AddHostedService<ReservationExpirationWorker>();

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
        policy.AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors(CorsPolicy);
app.UseMiddleware<ApiVersionHeaderMiddleware>();
app.UseAuthorization();
app.MapControllers();

using var scope = app.Services.CreateScope();
var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
await context.Database.MigrateAsync();
await DbSeeder.SeedAsync(context, passwordHashService);

app.Run();
